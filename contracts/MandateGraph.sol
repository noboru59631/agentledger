// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title MandateGraph
/// @notice Task-bound delegation and request-bound USDC payment authorization.
contract MandateGraph {
    error TaskAlreadyExists(); error UnknownTask(); error UnknownMandate(); error NotTaskOwner();
    error NotMandateAgent(); error InvalidBudget(); error InvalidExpiry(); error ScopeWidened();
    error RecipientWidened(); error DelegationDepthExhausted(); error AuthorityRevoked(uint256 mandateId);
    error AuthorityExpired(uint256 mandateId); error BudgetExceeded(); error PaymentExpired();
    error Replay(bytes32 paymentId); error InvalidRecipient(); error UsdcTransferFailed();
    error InvalidUsdc(); error InvalidOutcome(); error ReentrantCall(); error InvalidTaskHash();

    struct Task { address owner; uint128 budget; uint128 spent; uint64 deadline; bytes32 taskHash; bool revoked; }
    struct Mandate {
        bytes32 taskId; uint256 parentId; address agent; address recipient;
        uint128 budget; uint128 spent; uint128 allocated; uint64 expiry; uint8 depth;
        uint256 serviceScope; bool revoked;
    }

    IERC20 public immutable usdc;
    mapping(bytes32 => Task) public tasks;
    mapping(uint256 => Mandate) public mandates;
    mapping(bytes32 => bool) public usedPaymentIds;
    mapping(bytes32 => bytes32) public paymentRequestHashes;
    mapping(bytes32 => bytes32) public paymentOutcomeHashes;
    uint256 public nextMandateId = 1;
    uint256 private entered;

    event TaskCreated(bytes32 indexed taskId, uint256 indexed rootMandateId, address indexed owner, uint128 budget, bytes32 taskHash);
    event MandateDelegated(uint256 indexed parentId, uint256 indexed mandateId, address indexed agent, uint128 budget, uint64 expiry);
    event MandateRevoked(uint256 indexed mandateId, bytes32 indexed taskId);
    event PaymentExecuted(bytes32 indexed paymentId, bytes32 indexed taskId, uint256 indexed mandateId, address recipient, uint128 amount, uint256 serviceClass, bytes32 resourceHash, bytes32 outcomeHash);

    constructor(IERC20 usdc_) {
        if (address(usdc_) == address(0) || address(usdc_).code.length == 0) revert InvalidUsdc();
        usdc = usdc_;
    }

    function createTask(
        bytes32 taskId, bytes32 taskHash, uint128 budget, uint64 deadline, uint256 serviceScope,
        address rootAgent, address recipient, uint8 depth
    ) external returns (uint256 rootMandateId) {
        if (tasks[taskId].owner != address(0)) revert TaskAlreadyExists();
        if (budget == 0 || deadline <= block.timestamp || serviceScope == 0 || rootAgent == address(0) || depth > 32) revert InvalidBudget();
        if (taskHash == bytes32(0)) revert InvalidTaskHash();
        tasks[taskId] = Task(msg.sender, budget, 0, deadline, taskHash, false);
        rootMandateId = nextMandateId++;
        mandates[rootMandateId] = Mandate(taskId, 0, rootAgent, recipient, budget, 0, 0, deadline, depth, serviceScope, false);
        emit TaskCreated(taskId, rootMandateId, msg.sender, budget, taskHash);
    }

    function delegate(uint256 parentId, address childAgent, uint128 childBudget, uint64 childExpiry, uint256 childScope, address childRecipient) external returns (uint256 childId) {
        Mandate storage parent = mandates[parentId];
        if (parent.agent == address(0)) revert UnknownMandate();
        if (msg.sender != parent.agent) revert NotMandateAgent();
        _assertLive(parentId);
        if (childAgent == address(0) || childAgent == address(this) || childBudget == 0 || parent.spent + parent.allocated > parent.budget || childBudget > parent.budget - parent.spent - parent.allocated) revert InvalidBudget();
        if (childExpiry > parent.expiry || childExpiry > tasks[parent.taskId].deadline) revert InvalidExpiry();
        if ((childScope | parent.serviceScope) != parent.serviceScope || childScope == 0) revert ScopeWidened();
        if (parent.recipient != address(0) && childRecipient != parent.recipient) revert RecipientWidened();
        if (parent.depth == 0) revert DelegationDepthExhausted();
        parent.allocated += childBudget;
        childId = nextMandateId++;
        mandates[childId] = Mandate(parent.taskId, parentId, childAgent, childRecipient, childBudget, 0, 0, childExpiry, parent.depth - 1, childScope, false);
        emit MandateDelegated(parentId, childId, childAgent, childBudget, childExpiry);
    }

    function revokeTask(bytes32 taskId) external {
        Task storage task = tasks[taskId];
        if (task.owner == address(0)) revert UnknownTask();
        if (msg.sender != task.owner) revert NotTaskOwner();
        task.revoked = true;
        emit MandateRevoked(0, taskId);
    }

    function revokeMandate(uint256 mandateId) external {
        Mandate storage mandate = mandates[mandateId];
        if (mandate.agent == address(0)) revert UnknownMandate();
        if (msg.sender != mandate.agent) revert NotMandateAgent();
        mandate.revoked = true;
        emit MandateRevoked(mandateId, mandate.taskId);
    }

    function executePayment(
        uint256 mandateId, bytes32 paymentId, address recipient, uint128 amount, uint256 serviceClass,
        bytes32 resourceHash, uint64 requestExpiry, uint256 nonce, bytes32 outcomeHash
    ) external nonReentrant {
        Mandate storage mandate = mandates[mandateId];
        if (mandate.agent == address(0)) revert UnknownMandate();
        if (msg.sender != mandate.agent) revert NotMandateAgent();
        if (requestExpiry < block.timestamp || requestExpiry > mandate.expiry || requestExpiry > tasks[mandate.taskId].deadline) revert PaymentExpired();
        if (usedPaymentIds[paymentId]) revert Replay(paymentId);
        if (recipient == address(0) || (mandate.recipient != address(0) && recipient != mandate.recipient)) revert InvalidRecipient();
        if (amount == 0 || mandate.spent > mandate.budget || amount > mandate.budget - mandate.spent) revert BudgetExceeded();
        if ((serviceClass & mandate.serviceScope) != serviceClass || serviceClass == 0) revert ScopeWidened();
        if (outcomeHash == bytes32(0)) revert InvalidOutcome();
        bytes32 requestHash = keccak256(abi.encode(mandate.taskId, mandateId, recipient, amount, serviceClass, resourceHash, requestExpiry, nonce));
        if (paymentId != requestHash) revert Replay(paymentId);
        // nonce is committed in paymentId: keccak256(taskId, mandateId, recipient, amount, serviceClass, resourceHash, requestExpiry, nonce).
        _assertLive(mandateId);
        Task storage task = tasks[mandate.taskId];
        if (amount > task.budget || task.spent > task.budget || amount > task.budget - task.spent) revert BudgetExceeded();
        uint256 ancestor = mandateId;
        while (ancestor != 0) {
            Mandate storage node = mandates[ancestor];
            uint256 reserved = node.allocated;
            if (ancestor == mandateId) reserved = 0;
            if (node.spent > node.budget || reserved > node.budget - node.spent || amount > node.budget - node.spent - reserved) revert BudgetExceeded();
            ancestor = node.parentId;
        }
        usedPaymentIds[paymentId] = true;
        paymentRequestHashes[paymentId] = requestHash;
        paymentOutcomeHashes[paymentId] = outcomeHash;
        task.spent += amount;
        _recordAncestorSpend(mandateId, amount);
        _releaseAncestorAllocation(mandateId, amount);
        if (!usdc.transferFrom(msg.sender, recipient, amount)) revert UsdcTransferFailed();
        emit PaymentExecuted(paymentId, mandate.taskId, mandateId, recipient, amount, serviceClass, resourceHash, outcomeHash);
    }

    modifier nonReentrant() {
        if (entered != 0) revert ReentrantCall();
        entered = 1;
        _;
        entered = 0;
    }

    function isAuthorized(uint256 mandateId) external view returns (bool) {
        if (mandates[mandateId].agent == address(0)) return false;
        uint256 cursor = mandateId;
        while (cursor != 0) {
            Mandate storage mandate = mandates[cursor];
            if (mandate.revoked || mandate.expiry < block.timestamp || tasks[mandate.taskId].revoked || tasks[mandate.taskId].deadline < block.timestamp) return false;
            cursor = mandate.parentId;
        }
        return true;
    }

    function _assertLive(uint256 mandateId) internal view {
        uint256 cursor = mandateId;
        while (cursor != 0) {
            Mandate storage mandate = mandates[cursor];
            if (mandate.revoked || tasks[mandate.taskId].revoked) revert AuthorityRevoked(cursor);
            if (mandate.expiry < block.timestamp) revert AuthorityExpired(cursor);
            if (tasks[mandate.taskId].deadline < block.timestamp) revert AuthorityExpired(cursor);
            cursor = mandate.parentId;
        }
    }

    function _recordAncestorSpend(uint256 mandateId, uint128 amount) internal {
        uint256 cursor = mandateId;
        while (cursor != 0) { mandates[cursor].spent += amount; cursor = mandates[cursor].parentId; }
    }

    function _releaseAncestorAllocation(uint256 mandateId, uint128 amount) internal {
        uint256 cursor = mandates[mandateId].parentId;
        while (cursor != 0) {
            Mandate storage ancestor = mandates[cursor];
            ancestor.allocated -= amount;
            cursor = ancestor.parentId;
        }
    }
}
