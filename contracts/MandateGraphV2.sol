// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20SelfCustody {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC8004IdentityRegistryV2 {
    function ownerOf(uint256 agentId) external view returns (address);
}

/// @title MandateGraphV2
/// @notice Self-custodial, ERC-8004-owner-bound task authority and USDC settlement.
contract MandateGraphV2 {
    error TaskAlreadyExists(); error UnknownTask(); error UnknownMandate(); error NotTaskOwner();
    error NotMandateOperator(); error InvalidBudget(); error InvalidExpiry(); error ScopeWidened();
    error RecipientWidened(); error DelegationDepthExhausted(); error AuthorityRevoked(uint256 mandateId);
    error AuthorityExpired(uint256 mandateId); error BudgetExceeded(); error PaymentExpired();
    error Replay(bytes32 paymentId); error InvalidRecipient(); error UsdcTransferFailed();
    error InvalidUsdc(); error InvalidIdentityRegistry(); error InvalidOutcome(); error ReentrantCall();
    error InvalidTaskHash(); error InvalidTaskSalt(); error AuthorityCapExceeded(); error AgentStopped();
    error UnknownAgent(); error AgentAlreadyRegistered(); error NotAgentOwner(); error InvalidPromotion();
    error WorkProofAlreadyRecorded(bytes32 paymentId); error ActiveDelegations();
    error AgentOwnershipChanged(uint256 agentId, address expectedOwner, address currentOwner);

    struct Task {
        address owner;
        uint256 rootAgentId;
        uint128 budget;
        uint128 spent;
        uint64 deadline;
        bytes32 taskHash;
        bool revoked;
    }

    struct Mandate {
        bytes32 taskId;
        uint256 parentId;
        uint256 agentId;
        address recipient;
        uint128 budget;
        uint128 spent;
        uint128 allocated;
        uint64 expiry;
        uint8 depth;
        uint256 serviceScope;
        bool revoked;
        uint256 activeChildren;
    }

    enum Career { Trainee, Associate, Manager, Director }

    struct AgentProfile {
        address operationalAgent;
        Career career;
        uint128 authorityCap;
        uint32 completedWorks;
        uint32 violations;
        bool registered;
    }

    IERC20SelfCustody public immutable usdc;
    IERC8004IdentityRegistryV2 public immutable identityRegistry;
    mapping(bytes32 => Task) public tasks;
    mapping(uint256 => Mandate) public mandates;
    mapping(uint256 => AgentProfile) public agents;
    mapping(uint256 => bool) public stoppedAgents;
    mapping(uint256 => uint32) public lastPromotionWorkCount;
    mapping(bytes32 => bool) public usedPaymentIds;
    mapping(bytes32 => bytes32) public paymentOutcomeHashes;
    mapping(bytes32 => uint256) public paymentMandateIds;
    mapping(bytes32 => bool) public workProofRecorded;
    uint256 public nextMandateId = 1;
    uint256 private entered;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, address indexed operationalAgent, Career career, uint128 authorityCap);
    event OperationalAgentUpdated(uint256 indexed agentId, address indexed previousAgent, address indexed operationalAgent);
    event TaskCreated(bytes32 indexed taskId, uint256 indexed rootMandateId, address indexed owner, uint256 rootAgentId, uint128 budget, bytes32 taskHash);
    event MandateDelegated(uint256 indexed parentId, uint256 indexed mandateId, uint256 indexed agentId, uint128 budget, uint64 expiry);
    event MandateRevoked(uint256 indexed mandateId, bytes32 indexed taskId);
    event PaymentExecuted(bytes32 indexed paymentId, bytes32 indexed taskId, uint256 indexed mandateId, address payer, address recipient, uint128 amount, uint256 serviceClass, bytes32 resourceHash, bytes32 outcomeHash);
    event WorkProofRecorded(uint256 indexed agentId, bytes32 indexed taskId, bytes32 indexed paymentId, bytes32 proofHash, uint32 completedWorks);
    event Promotion(uint256 indexed agentId, Career fromCareer, Career toCareer, uint128 authorityCap);
    event Demotion(uint256 indexed agentId, Career fromCareer, Career toCareer, uint128 authorityCap, bytes32 reasonHash);
    event AgentReinstated(uint256 indexed agentId, bytes32 indexed remediationHash);

    constructor(IERC20SelfCustody usdc_, IERC8004IdentityRegistryV2 identityRegistry_) {
        if (address(usdc_) == address(0) || address(usdc_).code.length == 0) revert InvalidUsdc();
        if (address(identityRegistry_) == address(0) || address(identityRegistry_).code.length == 0) revert InvalidIdentityRegistry();
        usdc = usdc_;
        identityRegistry = identityRegistry_;
    }

    function registerAgent(uint256 agentId, address operationalAgent, uint128 initialAuthorityCap) external nonReentrant {
        if (agents[agentId].registered) revert AgentAlreadyRegistered();
        if (operationalAgent == address(0) || initialAuthorityCap == 0) revert UnknownAgent();
        address owner = _identityOwner(agentId);
        if (owner != msg.sender) revert NotAgentOwner();
        agents[agentId] = AgentProfile(operationalAgent, Career.Trainee, initialAuthorityCap, 0, 0, true);
        emit AgentRegistered(agentId, owner, operationalAgent, Career.Trainee, initialAuthorityCap);
    }

    function updateOperationalAgent(uint256 agentId, address operationalAgent) external nonReentrant {
        AgentProfile storage profile = _registeredAgent(agentId);
        _assertAgentOwner(agentId);
        if (operationalAgent == address(0)) revert UnknownAgent();
        address previousAgent = profile.operationalAgent;
        profile.operationalAgent = operationalAgent;
        emit OperationalAgentUpdated(agentId, previousAgent, operationalAgent);
    }

    function computeTaskId(address owner, bytes32 taskSalt) public pure returns (bytes32) {
        return keccak256(abi.encode(owner, taskSalt));
    }

    function createTask(
        bytes32 taskSalt,
        bytes32 taskHash,
        uint128 budget,
        uint64 deadline,
        uint256 serviceScope,
        uint256 rootAgentId,
        address recipient,
        uint8 depth
    ) external nonReentrant returns (bytes32 taskId, uint256 rootMandateId) {
        if (taskSalt == bytes32(0)) revert InvalidTaskSalt();
        taskId = computeTaskId(msg.sender, taskSalt);
        if (tasks[taskId].owner != address(0)) revert TaskAlreadyExists();
        if (budget == 0 || deadline <= block.timestamp || serviceScope == 0 || depth > 32) revert InvalidBudget();
        if (taskHash == bytes32(0)) revert InvalidTaskHash();
        AgentProfile storage profile = _registeredAgent(rootAgentId);
        if (_identityOwner(rootAgentId) != msg.sender) revert NotAgentOwner();
        if (stoppedAgents[rootAgentId]) revert AgentStopped();
        if (profile.authorityCap == 0) revert AuthorityCapExceeded();
        tasks[taskId] = Task(msg.sender, rootAgentId, budget, 0, deadline, taskHash, false);
        rootMandateId = nextMandateId++;
        mandates[rootMandateId] = Mandate(taskId, 0, rootAgentId, recipient, budget, 0, 0, deadline, depth, serviceScope, false, 0);
        emit TaskCreated(taskId, rootMandateId, msg.sender, rootAgentId, budget, taskHash);
    }

    function delegate(
        uint256 parentId,
        uint256 childAgentId,
        uint128 childBudget,
        uint64 childExpiry,
        uint256 childScope,
        address childRecipient
    ) external nonReentrant returns (uint256 childId) {
        Mandate storage parent = mandates[parentId];
        if (parent.taskId == bytes32(0)) revert UnknownMandate();
        Task storage task = tasks[parent.taskId];
        _assertMandateOperator(task.owner, parent.agentId);
        _assertLive(parentId);
        AgentProfile storage childProfile = _registeredAgent(childAgentId);
        if (_identityOwner(childAgentId) != task.owner) revert NotAgentOwner();
        if (stoppedAgents[childAgentId]) revert AgentStopped();
        if (childProfile.authorityCap == 0) revert AuthorityCapExceeded();
        if (
            childBudget == 0 || parent.spent > parent.budget || parent.allocated > parent.budget - parent.spent
                || childBudget > parent.budget - parent.spent - parent.allocated
        ) revert InvalidBudget();
        if (childExpiry < block.timestamp || childExpiry > parent.expiry) revert InvalidExpiry();
        if ((childScope | parent.serviceScope) != parent.serviceScope || childScope == 0) revert ScopeWidened();
        if (parent.recipient != address(0) && childRecipient != parent.recipient) revert RecipientWidened();
        if (parent.depth == 0) revert DelegationDepthExhausted();
        parent.allocated += childBudget;
        parent.activeChildren += 1;
        childId = nextMandateId++;
        mandates[childId] = Mandate(parent.taskId, parentId, childAgentId, childRecipient, childBudget, 0, 0, childExpiry, parent.depth - 1, childScope, false, 0);
        emit MandateDelegated(parentId, childId, childAgentId, childBudget, childExpiry);
    }

    function revokeTask(bytes32 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        if (task.owner == address(0)) revert UnknownTask();
        if (msg.sender != task.owner) revert NotTaskOwner();
        task.revoked = true;
        emit MandateRevoked(0, taskId);
    }

    function revokeMandate(uint256 mandateId) external nonReentrant {
        Mandate storage mandate = mandates[mandateId];
        if (mandate.taskId == bytes32(0)) revert UnknownMandate();
        Task storage task = tasks[mandate.taskId];
        _assertMandateOperator(task.owner, mandate.agentId);
        if (mandate.activeChildren != 0) revert ActiveDelegations();
        mandate.revoked = true;
        if (mandate.parentId != 0) {
            Mandate storage parent = mandates[mandate.parentId];
            uint128 released = mandate.budget - mandate.spent;
            parent.allocated -= released;
            parent.activeChildren -= 1;
        }
        emit MandateRevoked(mandateId, mandate.taskId);
    }

    function computePaymentId(
        bytes32 taskId,
        uint256 mandateId,
        address recipient,
        uint128 amount,
        uint256 serviceClass,
        bytes32 resourceHash,
        uint64 requestExpiry,
        uint256 nonce
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), taskId, mandateId, tasks[taskId].owner, recipient, amount, serviceClass, resourceHash, requestExpiry, nonce));
    }

    function executePayment(
        uint256 mandateId,
        bytes32 paymentId,
        address recipient,
        uint128 amount,
        uint256 serviceClass,
        bytes32 resourceHash,
        uint64 requestExpiry,
        uint256 nonce,
        bytes32 outcomeHash
    ) external nonReentrant {
        Mandate storage mandate = mandates[mandateId];
        if (mandate.taskId == bytes32(0)) revert UnknownMandate();
        Task storage task = tasks[mandate.taskId];
        _assertMandateOperator(task.owner, mandate.agentId);
        _assertPaymentAuthority(mandateId, amount);
        if (requestExpiry < block.timestamp || requestExpiry > mandate.expiry || requestExpiry > task.deadline) revert PaymentExpired();
        if (usedPaymentIds[paymentId]) revert Replay(paymentId);
        if (recipient == address(0) || (mandate.recipient != address(0) && recipient != mandate.recipient)) revert InvalidRecipient();
        if (amount == 0 || mandate.spent > mandate.budget || mandate.allocated > mandate.budget - mandate.spent || amount > mandate.budget - mandate.spent - mandate.allocated) revert BudgetExceeded();
        if ((serviceClass | mandate.serviceScope) != mandate.serviceScope || serviceClass == 0) revert ScopeWidened();
        if (outcomeHash == bytes32(0)) revert InvalidOutcome();
        bytes32 requestHash = computePaymentId(mandate.taskId, mandateId, recipient, amount, serviceClass, resourceHash, requestExpiry, nonce);
        if (paymentId != requestHash) revert Replay(paymentId);
        _assertLive(mandateId);
        if (amount > task.budget || task.spent > task.budget || amount > task.budget - task.spent) revert BudgetExceeded();
        uint256 ancestor = mandate.parentId;
        while (ancestor != 0) {
            Mandate storage node = mandates[ancestor];
            if (node.spent > node.budget || node.allocated > node.budget - node.spent || amount > node.allocated) revert BudgetExceeded();
            ancestor = node.parentId;
        }
        usedPaymentIds[paymentId] = true;
        paymentOutcomeHashes[paymentId] = outcomeHash;
        paymentMandateIds[paymentId] = mandateId;
        task.spent += amount;
        _recordSpendAndReleaseReservations(mandateId, amount);
        emit PaymentExecuted(paymentId, mandate.taskId, mandateId, task.owner, recipient, amount, serviceClass, resourceHash, outcomeHash);
        _transferUsdc(task.owner, recipient, amount);
    }

    function recordWorkProof(uint256 agentId, bytes32 taskId, bytes32 paymentId, bytes32 proofHash) external nonReentrant {
        AgentProfile storage profile = _registeredAgent(agentId);
        Task storage task = tasks[taskId];
        if (task.owner == address(0)) revert UnknownTask();
        if (task.owner != msg.sender) revert NotTaskOwner();
        if (_identityOwner(agentId) != task.owner) revert NotAgentOwner();
        uint256 mandateId = paymentMandateIds[paymentId];
        if (
            mandateId == 0 || mandates[mandateId].taskId != taskId || mandates[mandateId].agentId != agentId
                || proofHash == bytes32(0) || paymentOutcomeHashes[paymentId] != proofHash
        ) revert InvalidOutcome();
        if (workProofRecorded[paymentId]) revert WorkProofAlreadyRecorded(paymentId);
        workProofRecorded[paymentId] = true;
        profile.completedWorks += 1;
        emit WorkProofRecorded(agentId, taskId, paymentId, proofHash, profile.completedWorks);
    }

    function promoteAgent(uint256 agentId, Career nextCareer, uint128 nextAuthorityCap) external nonReentrant {
        AgentProfile storage profile = _registeredAgent(agentId);
        _assertAgentOwner(agentId);
        if (stoppedAgents[agentId]) revert AgentStopped();
        if (
            profile.career == Career.Director || uint8(nextCareer) != uint8(profile.career) + 1
                || nextAuthorityCap <= profile.authorityCap || profile.completedWorks <= lastPromotionWorkCount[agentId]
        ) revert InvalidPromotion();
        Career previous = profile.career;
        profile.career = nextCareer;
        profile.authorityCap = nextAuthorityCap;
        lastPromotionWorkCount[agentId] = profile.completedWorks;
        emit Promotion(agentId, previous, nextCareer, nextAuthorityCap);
    }

    function demoteAgent(uint256 agentId, bytes32 reasonHash) external nonReentrant {
        AgentProfile storage profile = _registeredAgent(agentId);
        _assertAgentOwner(agentId);
        if (reasonHash == bytes32(0)) revert InvalidOutcome();
        Career previous = profile.career;
        if (previous != Career.Trainee) profile.career = Career(uint8(previous) - 1);
        profile.authorityCap = profile.authorityCap / 2;
        profile.violations += 1;
        lastPromotionWorkCount[agentId] = profile.completedWorks;
        stoppedAgents[agentId] = true;
        emit Demotion(agentId, previous, profile.career, profile.authorityCap, reasonHash);
    }

    function reinstateAgent(uint256 agentId, bytes32 remediationHash) external nonReentrant {
        _registeredAgent(agentId);
        _assertAgentOwner(agentId);
        if (!stoppedAgents[agentId] || remediationHash == bytes32(0)) revert InvalidOutcome();
        stoppedAgents[agentId] = false;
        emit AgentReinstated(agentId, remediationHash);
    }

    function isAuthorized(uint256 mandateId) external view returns (bool) {
        Mandate storage initial = mandates[mandateId];
        if (initial.taskId == bytes32(0)) return false;
        Task storage task = tasks[initial.taskId];
        uint256 cursor = mandateId;
        while (cursor != 0) {
            Mandate storage mandate = mandates[cursor];
            if (
                mandate.revoked || mandate.expiry < block.timestamp || task.revoked || stoppedAgents[mandate.agentId]
                    || _identityOwnerOrZero(mandate.agentId) != task.owner
            ) return false;
            cursor = mandate.parentId;
        }
        return true;
    }

    function isPromotionEligible(uint256 agentId) external view returns (bool) {
        AgentProfile storage profile = agents[agentId];
        return profile.registered && !stoppedAgents[agentId] && profile.career != Career.Director
            && profile.completedWorks > lastPromotionWorkCount[agentId];
    }

    modifier nonReentrant() {
        if (entered != 0) revert ReentrantCall();
        entered = 1;
        _;
        entered = 0;
    }

    function _registeredAgent(uint256 agentId) internal view returns (AgentProfile storage profile) {
        profile = agents[agentId];
        if (!profile.registered) revert UnknownAgent();
    }

    function _assertMandateOperator(address taskOwner, uint256 agentId) internal view {
        AgentProfile storage profile = _registeredAgent(agentId);
        if (msg.sender != taskOwner && msg.sender != profile.operationalAgent) revert NotMandateOperator();
    }

    function _assertLive(uint256 mandateId) internal view {
        Task storage task = tasks[mandates[mandateId].taskId];
        uint256 cursor = mandateId;
        while (cursor != 0) {
            Mandate storage mandate = mandates[cursor];
            if (mandate.revoked || task.revoked) revert AuthorityRevoked(cursor);
            if (mandate.expiry < block.timestamp) revert AuthorityExpired(cursor);
            if (stoppedAgents[mandate.agentId]) revert AgentStopped();
            address currentOwner = _identityOwner(mandate.agentId);
            if (currentOwner != task.owner) revert AgentOwnershipChanged(mandate.agentId, task.owner, currentOwner);
            cursor = mandate.parentId;
        }
    }

    function _assertPaymentAuthority(uint256 mandateId, uint128 amount) internal view {
        uint256 cursor = mandateId;
        while (cursor != 0) {
            Mandate storage mandate = mandates[cursor];
            AgentProfile storage profile = _registeredAgent(mandate.agentId);
            if (stoppedAgents[mandate.agentId]) revert AgentStopped();
            if (amount > profile.authorityCap) revert AuthorityCapExceeded();
            cursor = mandate.parentId;
        }
    }

    function _assertAgentOwner(uint256 agentId) internal view {
        if (_identityOwner(agentId) != msg.sender) revert NotAgentOwner();
    }

    function _identityOwner(uint256 agentId) internal view returns (address owner) {
        owner = _identityOwnerOrZero(agentId);
        if (owner == address(0)) revert UnknownAgent();
    }

    function _identityOwnerOrZero(uint256 agentId) internal view returns (address owner) {
        try identityRegistry.ownerOf(agentId) returns (address currentOwner) {
            owner = currentOwner;
        } catch {
            owner = address(0);
        }
    }

    function _recordSpendAndReleaseReservations(uint256 mandateId, uint128 amount) internal {
        uint256 cursor = mandateId;
        while (cursor != 0) {
            Mandate storage node = mandates[cursor];
            node.spent += amount;
            if (node.parentId != 0) mandates[node.parentId].allocated -= amount;
            cursor = node.parentId;
        }
    }

    function _transferUsdc(address from, address recipient, uint128 amount) internal {
        (bool success, bytes memory returnData) = address(usdc).call(
            abi.encodeCall(IERC20SelfCustody.transferFrom, (from, recipient, amount))
        );
        if (!success || (returnData.length != 0 && (returnData.length < 32 || !abi.decode(returnData, (bool))))) {
            revert UsdcTransferFailed();
        }
    }
}
