// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MandateGraphV2, IERC20SelfCustody, IERC8004IdentityRegistryV2} from "../contracts/MandateGraphV2.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

interface VmV2 {
    function prank(address) external;
    function expectRevert(bytes calldata) external;
}

contract ReentrantTokenV2 is IERC20SelfCustody {
    address public target;
    bytes public payload;
    bool public attempted;
    bool public reentrySucceeded;
    bytes4 public reentryError;

    function configure(address target_, bytes calldata payload_) external { target = target_; payload = payload_; }
    function transferFrom(address, address, uint256) external returns (bool) {
        attempted = true;
        bytes memory returnData;
        (reentrySucceeded, returnData) = target.call(payload);
        if (returnData.length >= 4) {
            bytes4 selector;
            assembly { selector := mload(add(returnData, 32)) }
            reentryError = selector;
        }
        return true;
    }
}

contract IdentityRegistryV2Mock is IERC8004IdentityRegistryV2 {
    mapping(uint256 => address) private owners;

    function mint(address owner, uint256 agentId) external { owners[agentId] = owner; }
    function transfer(uint256 agentId, address newOwner) external {
        require(msg.sender == owners[agentId], "not owner");
        owners[agentId] = newOwner;
    }
    function ownerOf(uint256 agentId) external view returns (address owner) {
        owner = owners[agentId];
        require(owner != address(0), "unknown token");
    }
}

contract MandateGraphV2Test {
    VmV2 private constant vm = VmV2(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant ALICE_OPERATOR = address(0xA6E17);
    address private constant BOB_OPERATOR = address(0xB6E17);
    address private constant VENDOR = address(0xDADA);
    uint256 private constant ALICE_AGENT = 101;
    uint256 private constant ALICE_CHILD = 102;
    uint256 private constant BOB_AGENT = 201;

    MockUSDC private usdc;
    IdentityRegistryV2Mock private identity;
    MandateGraphV2 private graph;
    uint64 private deadline;

    function setUp() public {
        usdc = new MockUSDC();
        identity = new IdentityRegistryV2Mock();
        graph = new MandateGraphV2(IERC20SelfCustody(address(usdc)), identity);
        deadline = uint64(block.timestamp + 1 days);
        identity.mint(ALICE, ALICE_AGENT);
        identity.mint(ALICE, ALICE_CHILD);
        identity.mint(BOB, BOB_AGENT);
        vm.prank(ALICE); graph.registerAgent(ALICE_AGENT, ALICE_OPERATOR, 100_000);
        vm.prank(ALICE); graph.registerAgent(ALICE_CHILD, address(0xA6E18), 100_000);
        vm.prank(BOB); graph.registerAgent(BOB_AGENT, BOB_OPERATOR, 100_000);
        usdc.mint(ALICE, 1_000_000);
        usdc.mint(BOB, 1_000_000);
    }

    function testWalletCannotRegisterOrAdministerAnotherWalletAgent() public {
        identity.mint(BOB, 202);
        vm.prank(ALICE); vm.expectRevert(abi.encodeWithSelector(MandateGraphV2.NotAgentOwner.selector));
        graph.registerAgent(202, address(0x202), 1);
        vm.prank(ALICE); vm.expectRevert(abi.encodeWithSelector(MandateGraphV2.NotAgentOwner.selector));
        graph.demoteAgent(BOB_AGENT, keccak256("unauthorized"));
        vm.prank(ALICE); vm.expectRevert(abi.encodeWithSelector(MandateGraphV2.NotAgentOwner.selector));
        graph.updateOperationalAgent(BOB_AGENT, address(0x203));
    }

    function testTaskCreationIsNamespacedAndRequiresOwnedRootAgent() public {
        bytes32 salt = keccak256("same-user-salt");
        vm.prank(ALICE); (bytes32 aliceTask,) = graph.createTask(salt, keccak256("alice"), 100_000, deadline, 1, ALICE_AGENT, VENDOR, 1);
        vm.prank(BOB); (bytes32 bobTask,) = graph.createTask(salt, keccak256("bob"), 100_000, deadline, 1, BOB_AGENT, VENDOR, 1);
        require(aliceTask != bobTask, "task IDs are not owner namespaced");
        vm.prank(ALICE); vm.expectRevert(abi.encodeWithSelector(MandateGraphV2.NotAgentOwner.selector));
        graph.createTask(keccak256("foreign"), keccak256("foreign"), 100_000, deadline, 1, BOB_AGENT, VENDOR, 1);
    }

    function testDelegationCannotCrossWalletOwnership() public {
        vm.prank(ALICE); (, uint256 root) = graph.createTask(keccak256("isolation"), keccak256("task"), 100_000, deadline, 1, ALICE_AGENT, VENDOR, 2);
        vm.prank(ALICE); vm.expectRevert(abi.encodeWithSelector(MandateGraphV2.NotAgentOwner.selector));
        graph.delegate(root, BOB_AGENT, 50_000, deadline, 1, VENDOR);
        vm.prank(ALICE); uint256 child = graph.delegate(root, ALICE_CHILD, 50_000, deadline, 1, VENDOR);
        require(child == 2, "same-owner delegation failed");
    }

    function testOperationalAgentSpendsOnlyTaskOwnersApprovedUsdc() public {
        vm.prank(ALICE); (bytes32 taskId, uint256 mandateId) = graph.createTask(keccak256("pay"), keccak256("task"), 100_000, deadline, 1, ALICE_AGENT, VENDOR, 1);
        vm.prank(ALICE); usdc.approve(address(graph), 25_000);
        bytes32 resourceHash = keccak256("resource");
        bytes32 paymentId = graph.computePaymentId(taskId, mandateId, VENDOR, 25_000, 1, resourceHash, deadline, 1);
        vm.prank(ALICE_OPERATOR);
        graph.executePayment(mandateId, paymentId, VENDOR, 25_000, 1, resourceHash, deadline, 1, keccak256("outcome"));
        require(usdc.balanceOf(ALICE) == 975_000, "Alice was not payer");
        require(usdc.balanceOf(BOB) == 1_000_000, "Bob funds changed");
        require(usdc.balanceOf(VENDOR) == 25_000, "vendor not paid");
        require(usdc.allowance(ALICE, address(graph)) == 0, "allowance not consumed exactly");
    }

    function testOtherWalletCannotExecuteOrSpendTaskOwnerFunds() public {
        vm.prank(ALICE); (bytes32 taskId, uint256 mandateId) = graph.createTask(keccak256("blocked"), keccak256("task"), 100_000, deadline, 1, ALICE_AGENT, VENDOR, 1);
        vm.prank(ALICE); usdc.approve(address(graph), 50_000);
        vm.prank(BOB); usdc.approve(address(graph), 50_000);
        bytes32 resourceHash = keccak256("blocked");
        bytes32 paymentId = graph.computePaymentId(taskId, mandateId, VENDOR, 10_000, 1, resourceHash, deadline, 1);
        vm.prank(BOB); vm.expectRevert(abi.encodeWithSelector(MandateGraphV2.NotMandateOperator.selector));
        graph.executePayment(mandateId, paymentId, VENDOR, 10_000, 1, resourceHash, deadline, 1, keccak256("outcome"));
        require(usdc.balanceOf(ALICE) == 1_000_000, "Alice funds changed");
        require(usdc.balanceOf(BOB) == 1_000_000, "Bob funds changed");
    }

    function testOwnershipTransferFreezesOldTasksAndMovesAdministration() public {
        vm.prank(ALICE); (bytes32 taskId, uint256 mandateId) = graph.createTask(keccak256("transfer"), keccak256("task"), 100_000, deadline, 1, ALICE_AGENT, VENDOR, 1);
        vm.prank(ALICE); usdc.approve(address(graph), 100_000);
        vm.prank(ALICE); identity.transfer(ALICE_AGENT, BOB);

        vm.prank(ALICE); vm.expectRevert(abi.encodeWithSelector(MandateGraphV2.NotAgentOwner.selector));
        graph.demoteAgent(ALICE_AGENT, keccak256("old owner"));

        bytes32 resourceHash = keccak256("old task");
        bytes32 paymentId = graph.computePaymentId(taskId, mandateId, VENDOR, 1, 1, resourceHash, deadline, 1);
        vm.prank(ALICE); vm.expectRevert(abi.encodeWithSelector(MandateGraphV2.AgentOwnershipChanged.selector, ALICE_AGENT, ALICE, BOB));
        graph.executePayment(mandateId, paymentId, VENDOR, 1, 1, resourceHash, deadline, 1, keccak256("outcome"));
        require(usdc.balanceOf(ALICE) == 1_000_000, "old task spent after transfer");
        require(!graph.isAuthorized(mandateId), "old task remained authorized");

        vm.prank(BOB); graph.updateOperationalAgent(ALICE_AGENT, BOB_OPERATOR);
        vm.prank(BOB); graph.demoteAgent(ALICE_AGENT, keccak256("new owner"));
    }

    function testAuthorityCapIsSimulatedBeforeAnyTransfer() public {
        vm.prank(ALICE); (bytes32 taskId, uint256 mandateId) = graph.createTask(keccak256("over-cap"), keccak256("task"), 200_000, deadline, 1, ALICE_AGENT, VENDOR, 1);
        vm.prank(ALICE); usdc.approve(address(graph), 100_001);
        bytes32 resourceHash = keccak256("over-cap");
        bytes32 paymentId = graph.computePaymentId(taskId, mandateId, VENDOR, 100_001, 1, resourceHash, deadline, 1);
        vm.prank(ALICE); vm.expectRevert(abi.encodeWithSelector(MandateGraphV2.AuthorityCapExceeded.selector));
        graph.executePayment(mandateId, paymentId, VENDOR, 100_001, 1, resourceHash, deadline, 1, keccak256("outcome"));
        require(!graph.usedPaymentIds(paymentId), "failed simulation consumed payment ID");
        require(usdc.balanceOf(VENDOR) == 0, "failed simulation transferred funds");
    }

    function testPaymentReplayIsRejectedWithoutSecondTransfer() public {
        vm.prank(ALICE); (bytes32 taskId, uint256 mandateId) = graph.createTask(keccak256("replay"), keccak256("task"), 100_000, deadline, 1, ALICE_AGENT, VENDOR, 1);
        vm.prank(ALICE); usdc.approve(address(graph), 20_000);
        bytes32 resourceHash = keccak256("replay");
        bytes32 paymentId = graph.computePaymentId(taskId, mandateId, VENDOR, 10_000, 1, resourceHash, deadline, 1);
        vm.prank(ALICE); graph.executePayment(mandateId, paymentId, VENDOR, 10_000, 1, resourceHash, deadline, 1, keccak256("outcome"));
        vm.prank(ALICE); vm.expectRevert(abi.encodeWithSelector(MandateGraphV2.Replay.selector, paymentId));
        graph.executePayment(mandateId, paymentId, VENDOR, 10_000, 1, resourceHash, deadline, 1, keccak256("outcome"));
        require(usdc.balanceOf(VENDOR) == 10_000, "replay transferred twice");
    }

    function testCrossFunctionReentrancyIsRejected() public {
        ReentrantTokenV2 token = new ReentrantTokenV2();
        IdentityRegistryV2Mock isolatedIdentity = new IdentityRegistryV2Mock();
        MandateGraphV2 isolated = new MandateGraphV2(token, isolatedIdentity);
        isolatedIdentity.mint(ALICE, 999);
        vm.prank(ALICE); isolated.registerAgent(999, ALICE, 100_000);
        vm.prank(ALICE); (bytes32 taskId, uint256 mandateId) = isolated.createTask(keccak256("reentrant"), keccak256("task"), 100_000, deadline, 1, 999, VENDOR, 0);
        token.configure(address(isolated), abi.encodeCall(isolated.revokeTask, (taskId)));
        bytes32 resourceHash = keccak256("reentrant");
        bytes32 paymentId = isolated.computePaymentId(taskId, mandateId, VENDOR, 10_000, 1, resourceHash, deadline, 1);
        vm.prank(ALICE); isolated.executePayment(mandateId, paymentId, VENDOR, 10_000, 1, resourceHash, deadline, 1, keccak256("outcome"));
        require(token.attempted(), "reentry not attempted");
        require(!token.reentrySucceeded(), "reentry succeeded");
        require(token.reentryError() == MandateGraphV2.ReentrantCall.selector, "wrong reentry error");
        require(isolated.usedPaymentIds(paymentId), "outer payment failed");
    }

    function testProofPromotionStopAndReinstatementKeepReducedCap() public {
        vm.prank(ALICE); (bytes32 taskId, uint256 mandateId) = graph.createTask(keccak256("career"), keccak256("task"), 200_000, deadline, 1, ALICE_AGENT, VENDOR, 1);
        vm.prank(ALICE); usdc.approve(address(graph), 100_000);
        bytes32 resourceHash = keccak256("career");
        bytes32 outcomeHash = keccak256("proof");
        bytes32 paymentId = graph.computePaymentId(taskId, mandateId, VENDOR, 25_000, 1, resourceHash, deadline, 1);
        vm.prank(ALICE); graph.executePayment(mandateId, paymentId, VENDOR, 25_000, 1, resourceHash, deadline, 1, outcomeHash);
        vm.prank(ALICE); graph.recordWorkProof(ALICE_AGENT, taskId, paymentId, outcomeHash);
        require(graph.isPromotionEligible(ALICE_AGENT), "promotion should be eligible");
        vm.prank(ALICE); graph.promoteAgent(ALICE_AGENT, MandateGraphV2.Career.Associate, 200_000);
        vm.prank(ALICE); graph.demoteAgent(ALICE_AGENT, keccak256("violation"));
        require(graph.stoppedAgents(ALICE_AGENT), "STOP not applied");
        (, MandateGraphV2.Career career, uint128 reducedCap, uint32 completedWorks, uint32 violations, bool registered) = graph.agents(ALICE_AGENT);
        require(career == MandateGraphV2.Career.Trainee, "career not reduced");
        require(reducedCap == 100_000 && completedWorks == 1 && violations == 1 && registered, "demotion state incorrect");
        vm.prank(ALICE); graph.reinstateAgent(ALICE_AGENT, keccak256("remediation"));
        (, , uint128 capAfterReinstatement, , , ) = graph.agents(ALICE_AGENT);
        require(capAfterReinstatement == reducedCap, "reinstatement restored cap");
        require(!graph.stoppedAgents(ALICE_AGENT), "agent still stopped");
    }

    function testFuzzPaymentNeverExceedsTaskOrAuthority(uint128 rawAmount) public {
        uint128 amount = uint128(uint256(rawAmount) % 100_000 + 1);
        vm.prank(ALICE); (bytes32 taskId, uint256 mandateId) = graph.createTask(keccak256(abi.encode(rawAmount)), keccak256("task"), 100_000, deadline, 1, ALICE_AGENT, VENDOR, 1);
        vm.prank(ALICE); usdc.approve(address(graph), amount);
        bytes32 resourceHash = keccak256(abi.encode(amount));
        bytes32 paymentId = graph.computePaymentId(taskId, mandateId, VENDOR, amount, 1, resourceHash, deadline, 1);
        vm.prank(ALICE); graph.executePayment(mandateId, paymentId, VENDOR, amount, 1, resourceHash, deadline, 1, keccak256("outcome"));
        (, , uint128 taskBudget, uint128 taskSpent, , , ) = graph.tasks(taskId);
        require(taskSpent == amount && taskSpent <= taskBudget, "task accounting violated");
    }
}
