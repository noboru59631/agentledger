// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MandateGraph} from "../contracts/MandateGraph.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

interface Vm { function prank(address) external; function expectRevert(bytes calldata) external; function warp(uint256) external; }

contract MandateGraphTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant HUMAN = address(0xA11CE);
    address private constant RESEARCH = address(0xB0B);
    address private constant TRANSLATOR = address(0xCAFE);
    address private constant VENDOR = address(0xDADA);
    MockUSDC usdc; MandateGraph graph; bytes32 taskId = keccak256("task"); uint64 deadline;

    function setUp() public {
        deadline = uint64(block.timestamp + 1 days);
        usdc = new MockUSDC(); graph = new MandateGraph(usdc);
        vm.prank(HUMAN);
        graph.createTask(taskId, keccak256("metadata"), 5_000_000, deadline, 3, RESEARCH, address(0), 2);
        vm.prank(RESEARCH);
        graph.delegate(1, TRANSLATOR, 1_000_000, deadline, 1, address(0));
        usdc.mint(TRANSLATOR, 1_000_000);
        vm.prank(TRANSLATOR); usdc.approve(address(graph), type(uint256).max);
    }

    function testMultiHopPaymentAndAttribution() public {
        vm.prank(TRANSLATOR);
        graph.executePayment(2, _id(2, VENDOR, 200_000, 1, keccak256("request"), deadline, 1), VENDOR, 200_000, 1, keccak256("request"), deadline, 1, keccak256("outcome"));
        (, uint128 budget, uint128 spent, , , ) = graph.tasks(taskId);
        require(budget == 5_000_000 && spent == 200_000, "task attribution failed");
        (,,,,,uint128 rootSpent,,,,,) = graph.mandates(1);
        (,,,,,uint128 childSpent,,,,,) = graph.mandates(2);
        require(rootSpent == 200_000 && childSpent == 200_000, "agent attribution failed");
    }

    function testRejectsChildBudgetOverrun() public {
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidBudget.selector));
        graph.delegate(1, address(0x123), 4_000_001, deadline, 1, address(0));
    }
    function testRejectsChildBudgetOverrunAfterParentSpend() public {
        vm.prank(RESEARCH);
        graph.delegate(1, address(0x123), 3_000_000, deadline, 1, address(0));
        vm.prank(address(0x123)); usdc.mint(address(0x123), 2_000_000);
        vm.prank(address(0x123)); usdc.approve(address(graph), type(uint256).max);
        vm.prank(address(0x123));
        vm.expectRevert(abi.encodeWithSelector(MandateGraph.BudgetExceeded.selector));
        graph.executePayment(3, _id(3, VENDOR, 2_000_000, 1, keccak256("parent-use"), deadline, 19), VENDOR, 2_000_000, 1, keccak256("parent-use"), deadline, 19, keccak256("outcome"));
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidBudget.selector));
        graph.delegate(1, address(0x124), 2_000_001, deadline, 1, address(0));
    }
    function testRejectsUnauthorizedDelegation() public {
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.NotMandateAgent.selector));
        graph.delegate(1, address(0x123), 1, deadline, 1, address(0));
    }
    function testRejectsExpiryExtension() public {
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidExpiry.selector));
        graph.delegate(1, address(0x123), 1, deadline + 1, 1, address(0));
    }
    function testRejectsChildExpiryBeyondTaskDeadline() public {
        vm.prank(HUMAN);
        graph.createTask(keccak256("short-task"), keccak256("m"), 5, uint64(block.timestamp + 10), 1, RESEARCH, address(0), 1);
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidExpiry.selector));
        graph.delegate(3, TRANSLATOR, 1, deadline, 1, address(0));
    }
    function testRejectsScopeWidening() public {
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.ScopeWidened.selector));
        graph.delegate(1, address(0x123), 1, deadline, 7, address(0));
    }
    function testRejectsRecipientWidening() public {
        vm.prank(HUMAN);
        graph.createTask(keccak256("restricted"), keccak256("m"), 5, deadline, 1, RESEARCH, VENDOR, 1);
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.RecipientWidened.selector));
        graph.delegate(3, TRANSLATOR, 1, deadline, 1, address(0xBEEF));
    }
    function testRejectsDelegationDepthExhaustion() public {
        vm.prank(TRANSLATOR);
        graph.delegate(2, address(0x123), 1, deadline, 1, address(0));
        vm.prank(address(0x123)); vm.expectRevert(abi.encodeWithSelector(MandateGraph.DelegationDepthExhausted.selector));
        graph.delegate(3, address(0x124), 1, deadline, 1, address(0));
    }
    function testRejectsReplayAndDuplicatePayment() public {
        bytes32 id = _id(2, VENDOR, 1, 1, keccak256("r"), deadline, 5);
        vm.prank(TRANSLATOR); graph.executePayment(2, id, VENDOR, 1, 1, keccak256("r"), deadline, 5, keccak256("o"));
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.Replay.selector, id));
        graph.executePayment(2, id, VENDOR, 1, 1, keccak256("r"), deadline, 5, keccak256("o"));
    }
    function testRejectsPaymentIdTampering() public {
        bytes32 id = keccak256("arbitrary");
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.Replay.selector, id));
        graph.executePayment(2, id, VENDOR, 1, 1, keccak256("r"), deadline, 8, keccak256("o"));
    }
    function testRejectsUnauthorizedPaymentCaller() public {
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.NotMandateAgent.selector));
        graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("r"), deadline, 9), VENDOR, 1, 1, keccak256("r"), deadline, 9, keccak256("o"));
    }
    function testRejectsEmptyOutcomeHash() public {
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidOutcome.selector));
        graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("r"), deadline, 11), VENDOR, 1, 1, keccak256("r"), deadline, 11, bytes32(0));
    }
    function testRejectsRequestExpiryBeyondMandateExpiry() public {
        uint64 later = deadline + 1 days;
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.PaymentExpired.selector));
        graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("r"), later, 29), VENDOR, 1, 1, keccak256("r"), later, 29, keccak256("o"));
    }
    function testRejectsZeroTaskHash() public {
        vm.prank(HUMAN); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidTaskHash.selector));
        graph.createTask(keccak256("zero-hash"), bytes32(0), 5, deadline, 1, RESEARCH, address(0), 1);
    }
    function testRootRevocationCascades() public {
        vm.prank(HUMAN); graph.revokeTask(taskId);
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AuthorityRevoked.selector, 2));
        graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("r"), deadline, 2), VENDOR, 1, 1, keccak256("r"), deadline, 2, keccak256("o"));
    }
    function testSubtreeRevocationCascades() public {
        vm.prank(RESEARCH); graph.revokeMandate(1);
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AuthorityRevoked.selector, 1));
        graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("r"), deadline, 2), VENDOR, 1, 1, keccak256("r"), deadline, 2, keccak256("o"));
    }
    function testChildBudgetExhaustion() public {
        vm.prank(TRANSLATOR); graph.executePayment(2, _id(2, VENDOR, 1_000_000, 1, keccak256("r"), deadline, 3), VENDOR, 1_000_000, 1, keccak256("r"), deadline, 3, keccak256("o"));
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.BudgetExceeded.selector));
        graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("r"), deadline, 4), VENDOR, 1, 1, keccak256("r"), deadline, 4, keccak256("o"));
    }
    function testRecoveredChildCapacityCanBeReallocated() public {
        vm.prank(TRANSLATOR);
        graph.executePayment(2, _id(2, VENDOR, 1_000_000, 1, keccak256("spent"), deadline, 31), VENDOR, 1_000_000, 1, keccak256("spent"), deadline, 31, keccak256("outcome"));
        vm.prank(RESEARCH);
        graph.delegate(1, address(0x1234), 1_000_000, deadline, 1, address(0));
        (,,,,,,,,uint256 allocated,,) = graph.mandates(1);
        require(allocated == 1_000_000, "spent child reservation was not released");
        (,,,,,uint128 parentSpent,,,,,) = graph.mandates(1);
        require(parentSpent == 1_000_000, "ancestor spend was not retained");
    }
    function testTaskDeadlineExpiresMandateEvenIfMandateExpiryIsLater() public {
        vm.prank(HUMAN);
        graph.createTask(keccak256("short-task"), keccak256("m"), 5, uint64(block.timestamp + 10), 1, RESEARCH, address(0), 1);
        vm.warp(block.timestamp + 11);
        require(!graph.isAuthorized(3), "mandate live after task deadline");
    }
    function testParentCannotSpendChildAllocationTwice() public {
        usdc.mint(RESEARCH, 5_000_000);
        vm.prank(RESEARCH); usdc.approve(address(graph), type(uint256).max);
        vm.prank(RESEARCH);
        graph.executePayment(1, _id(1, VENDOR, 4_000_000, 1, keccak256("r"), deadline, 20), VENDOR, 4_000_000, 1, keccak256("r"), deadline, 20, keccak256("o"));
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.BudgetExceeded.selector));
        graph.executePayment(1, _id(1, VENDOR, 1, 1, keccak256("r"), deadline, 21), VENDOR, 1, 1, keccak256("r"), deadline, 21, keccak256("o"));
    }
    function testExpiredRequestFails() public {
        vm.warp(deadline + 1); vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.PaymentExpired.selector));
        graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("r"), deadline, 4), VENDOR, 1, 1, keccak256("r"), deadline, 4, keccak256("o"));
    }
    function _id(uint256 mandateId, address recipient, uint128 amount, uint256 serviceClass, bytes32 resourceHash, uint64 requestExpiry, uint256 nonce) private view returns (bytes32) {
        return keccak256(abi.encode(taskId, mandateId, recipient, amount, serviceClass, resourceHash, requestExpiry, nonce));
    }
}
