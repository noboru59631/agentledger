// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20, IERC8004IdentityRegistry, MandateGraph} from "../contracts/MandateGraph.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

interface Vm {
    function prank(address) external;
    function expectRevert(bytes calldata) external;
    function expectEmit(bool, bool, bool, bool) external;
    function warp(uint256) external;
}

contract ReentrantUSDC is IERC20 {
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

contract FalseReturnUSDC is IERC20 {
    function transferFrom(address, address, uint256) external pure returns (bool) { return false; }
}

contract MockIdentityRegistry is IERC8004IdentityRegistry {
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

contract MandateGraphTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant HUMAN = address(0xA11CE);
    address private constant RESEARCH = address(0xB0B);
    address private constant TRANSLATOR = address(0xCAFE);
    address private constant CAREER_AGENT = address(0xC0FFEE);
    address private constant VENDOR = address(0xDADA);
    MockUSDC usdc; MockIdentityRegistry identity; MandateGraph graph; bytes32 taskId = keccak256("task"); uint64 deadline;

    function setUp() public {
        deadline = uint64(block.timestamp + 1 days);
        usdc = new MockUSDC(); identity = new MockIdentityRegistry(); graph = new MandateGraph(usdc, identity);
        identity.mint(HUMAN, 1); identity.mint(HUMAN, 2);
        vm.prank(HUMAN); graph.registerAgent(RESEARCH, 1, 5_000_000);
        vm.prank(HUMAN); graph.registerAgent(TRANSLATOR, 2, 1_000_000);
        identity.mint(HUMAN, 3); identity.mint(HUMAN, 4); identity.mint(HUMAN, 5); identity.mint(HUMAN, 6);
        vm.prank(HUMAN); graph.registerAgent(address(0x123), 3, 5_000_000);
        vm.prank(HUMAN); graph.registerAgent(address(0x124), 4, 5_000_000);
        vm.prank(HUMAN); graph.registerAgent(address(0x125), 5, 5_000_000);
        vm.prank(HUMAN); graph.registerAgent(address(0x126), 6, 5_000_000);
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
        (,,,,,uint128 rootSpent,uint128 rootAllocated,,,,,) = graph.mandates(1);
        (,,,,,uint128 childSpent,uint128 childAllocated,,,,,) = graph.mandates(2);
        require(rootSpent == 200_000 && childSpent == 200_000, "agent attribution failed");
        require(rootAllocated == 800_000 && childAllocated == 0, "reservation accounting failed");
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
        vm.prank(HUMAN); graph.revokeTask(taskId);
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AuthorityRevoked.selector, 2));
        graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("r"), deadline, 2), VENDOR, 1, 1, keccak256("r"), deadline, 2, keccak256("o"));
    }
    function testChildBudgetExhaustion() public {
        vm.prank(TRANSLATOR); graph.executePayment(2, _id(2, VENDOR, 1_000_000, 1, keccak256("r"), deadline, 3), VENDOR, 1_000_000, 1, keccak256("r"), deadline, 3, keccak256("o"));
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.BudgetExceeded.selector));
        graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("r"), deadline, 4), VENDOR, 1, 1, keccak256("r"), deadline, 4, keccak256("o"));
    }
    function testParentCannotSpendChildAllocationTwice() public {
        usdc.mint(RESEARCH, 4_000_000);
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
    function testParentCannotSpendAfterDelegatingEntireBudget() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 5_000_000, deadline, 1, address(0));
        usdc.mint(RESEARCH, 1);
        vm.prank(RESEARCH); usdc.approve(address(graph), type(uint256).max);
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.BudgetExceeded.selector));
        graph.executePayment(1, _id(1, VENDOR, 1, 1, keccak256("entire"), deadline, 40), VENDOR, 1, 1, keccak256("entire"), deadline, 40, keccak256("o"));
    }
    function testPartialReservationLeavesParentRemainder() public {
        usdc.mint(RESEARCH, 4_000_000);
        vm.prank(RESEARCH); usdc.approve(address(graph), type(uint256).max);
        vm.prank(RESEARCH); graph.executePayment(1, _id(1, VENDOR, 4_000_000, 1, keccak256("remainder"), deadline, 41), VENDOR, 4_000_000, 1, keccak256("remainder"), deadline, 41, keccak256("o"));
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.BudgetExceeded.selector));
        graph.executePayment(1, _id(1, VENDOR, 1, 1, keccak256("none"), deadline, 42), VENDOR, 1, 1, keccak256("none"), deadline, 42, keccak256("o"));
    }
    function testSiblingDelegationsCannotOversubscribe() public {
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 4_000_000, deadline, 1, address(0));
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidBudget.selector));
        graph.delegate(1, address(0x124), 1_000_001, deadline, 1, address(0));
    }
    function testSiblingChildrenCanBothSpendReservedBudgets() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 2_000_000, deadline, 1, address(0));
        vm.prank(RESEARCH); graph.delegate(1, address(0x124), 2_000_000, deadline, 1, address(0));
        address sibling = address(0x124);
        usdc.mint(sibling, 2_000_000);
        vm.prank(sibling); usdc.approve(address(graph), type(uint256).max);
        vm.prank(sibling); graph.executePayment(4, _id(4, VENDOR, 2_000_000, 1, keccak256("sibling"), deadline, 48), VENDOR, 2_000_000, 1, keccak256("sibling"), deadline, 48, keccak256("o"));
        address firstSibling = address(0x123);
        usdc.mint(firstSibling, 2_000_000);
        vm.prank(firstSibling); usdc.approve(address(graph), type(uint256).max);
        vm.prank(firstSibling); graph.executePayment(3, _id(3, VENDOR, 2_000_000, 1, keccak256("child"), deadline, 49), VENDOR, 2_000_000, 1, keccak256("child"), deadline, 49, keccak256("o"));
        (,,,,,uint128 rootSpent, uint128 rootAllocated,,,,,) = graph.mandates(1);
        require(rootSpent == 4_000_000 && rootAllocated == 0, "sibling reservation accounting");
    }
    function testDescendantPaymentConvertsReservationToAncestorSpend() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 2_000_000, deadline, 1, address(0));
        vm.prank(address(0x123)); graph.delegate(3, address(0x125), 1_000_000, deadline, 1, address(0));
        usdc.mint(address(0x125), 600_000);
        vm.prank(address(0x125)); usdc.approve(address(graph), type(uint256).max);
        vm.prank(address(0x125)); graph.executePayment(4, _id(4, VENDOR, 600_000, 1, keccak256("grandchild"), deadline, 43), VENDOR, 600_000, 1, keccak256("grandchild"), deadline, 43, keccak256("o"));
        (,,,,,uint128 rootSpent, uint128 rootAllocated,,,,,) = graph.mandates(1);
        (,,,,,uint128 childSpent, uint128 childAllocated,,,,,) = graph.mandates(3);
        require(rootSpent == 600_000 && rootAllocated == 1_400_000, "root accounting");
        require(childSpent == 600_000 && childAllocated == 400_000, "child accounting");
    }
    function testRevokingLeafReturnsOnlyUnusedAllocationAndAllowsRedelegation() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 1_000_000, deadline, 1, address(0));
        usdc.mint(address(0x123), 400_000);
        vm.prank(address(0x123)); usdc.approve(address(graph), type(uint256).max);
        vm.prank(address(0x123)); graph.executePayment(3, _id(3, VENDOR, 400_000, 1, keccak256("spent"), deadline, 44), VENDOR, 400_000, 1, keccak256("spent"), deadline, 44, keccak256("o"));
        vm.prank(address(0x123)); graph.revokeMandate(3);
        vm.prank(RESEARCH); graph.delegate(1, address(0x124), 600_000, deadline, 1, address(0));
        (,,,,,uint128 rootSpent, uint128 rootAllocated,,,,,) = graph.mandates(1);
        require(rootSpent == 400_000 && rootAllocated == 600_000, "spent authority resurrected");
    }
    function testRevokingChildWithGrandchildReturnsOnlyItsUncommittedRemainder() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 2_000_000, deadline, 1, address(0));
        vm.prank(address(0x123)); graph.delegate(3, address(0x125), 1_000_000, deadline, 1, address(0));
        usdc.mint(address(0x125), 400_000);
        vm.prank(address(0x125)); usdc.approve(address(graph), type(uint256).max);
        vm.prank(address(0x125)); graph.executePayment(4, _id(4, VENDOR, 400_000, 1, keccak256("nested"), deadline, 50), VENDOR, 400_000, 1, keccak256("nested"), deadline, 50, keccak256("o"));
        vm.prank(address(0x125)); graph.revokeMandate(4);
        vm.prank(address(0x123)); graph.revokeMandate(3);
        vm.prank(RESEARCH); graph.delegate(1, address(0x124), 1_600_000, deadline, 1, address(0));
        (,,,,,uint128 rootSpent, uint128 rootAllocated,,,,,) = graph.mandates(1);
        require(rootSpent == 400_000 && rootAllocated == 1_600_000, "nested revocation restored spent authority");
    }
    function testCannotRevokeParentBeforeChild() public {
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.ActiveDelegations.selector));
        graph.revokeMandate(1);
    }
    function testRevocationThenRedelegationBoundaryAndSpentCannotBeReused() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 1, deadline, 1, address(0));
        vm.prank(address(0x123)); usdc.mint(address(0x123), 1);
        vm.prank(address(0x123)); usdc.approve(address(graph), type(uint256).max);
        vm.prank(address(0x123)); graph.executePayment(3, _id(3, VENDOR, 1, 1, keccak256("unit"), deadline, 45), VENDOR, 1, 1, keccak256("unit"), deadline, 45, keccak256("o"));
        vm.prank(address(0x123)); graph.revokeMandate(3);
        vm.prank(RESEARCH); graph.delegate(1, address(0x124), 4_999_999, deadline, 1, address(0));
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidBudget.selector));
        graph.delegate(1, address(0x126), 1, deadline, 1, address(0));
    }
    function testSubtreeMustBeRevokedLeafFirstThenReturnsOnlyUnused() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 1_000_000, deadline, 1, address(0));
        vm.prank(address(0x123)); graph.delegate(3, address(0x125), 400_000, deadline, 1, address(0));
        vm.prank(address(0x125)); graph.revokeMandate(4);
        vm.prank(address(0x123)); graph.revokeMandate(3);
        (,,,,,uint128 rootSpent, uint128 rootAllocated,,,,,) = graph.mandates(1);
        require(rootSpent == 0 && rootAllocated == 0, "unused subtree reservation not returned");
    }
    function testRootRevocationBlocksDescendantDelegationWithBudgetRemaining() public {
        vm.prank(HUMAN); graph.revokeTask(taskId);
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AuthorityRevoked.selector, 1));
        graph.delegate(1, address(0x123), 1, deadline, 1, address(0));
    }
    function testNestedNoSpendLeafThenParentRevocationReturnsAuthorityAtEachLevel() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 2_000_000, deadline, 1, address(0));
        vm.prank(address(0x123)); graph.delegate(3, address(0x124), 1_000_000, deadline, 1, address(0));
        _assertAccounting(1, 5_000_000, 0, 2_000_000);
        _assertAccounting(3, 2_000_000, 0, 1_000_000);
        vm.prank(address(0x124)); graph.revokeMandate(4);
        _assertAccounting(1, 5_000_000, 0, 2_000_000);
        _assertAccounting(3, 2_000_000, 0, 0);
        vm.prank(address(0x123)); graph.revokeMandate(3);
        _assertAccounting(1, 5_000_000, 0, 0);
    }
    function testNestedPartialSpendRevocationNeverReleasesSpentAuthority() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 2_000_000, deadline, 1, address(0));
        vm.prank(address(0x123)); graph.delegate(3, address(0x124), 1_000_000, deadline, 1, address(0));
        usdc.mint(address(0x124), 400_000);
        vm.prank(address(0x124)); usdc.approve(address(graph), type(uint256).max);
        vm.prank(address(0x124)); graph.executePayment(4, _id(4, VENDOR, 400_000, 1, keccak256("partial"), deadline, 60), VENDOR, 400_000, 1, keccak256("partial"), deadline, 60, keccak256("outcome"));
        _assertAccounting(1, 5_000_000, 400_000, 1_600_000);
        _assertAccounting(3, 2_000_000, 400_000, 600_000);
        vm.prank(address(0x124)); graph.revokeMandate(4);
        _assertAccounting(1, 5_000_000, 400_000, 1_600_000);
        _assertAccounting(3, 2_000_000, 400_000, 0);
        vm.prank(address(0x123)); graph.revokeMandate(3);
        _assertAccounting(1, 5_000_000, 400_000, 0);
        vm.prank(RESEARCH); graph.delegate(1, address(0x125), 4_600_000, deadline, 1, address(0));
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidBudget.selector));
        graph.delegate(1, address(0x126), 1, deadline, 1, address(0));
    }
    function testRevokingOneNestedSiblingSubtreeDoesNotCorruptTheOther() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 2_000_000, deadline, 1, address(0));
        vm.prank(RESEARCH); graph.delegate(1, address(0x124), 1_500_000, deadline, 1, address(0));
        vm.prank(address(0x123)); graph.delegate(3, address(0x125), 1_000_000, deadline, 1, address(0));
        vm.prank(address(0x125)); graph.revokeMandate(5);
        vm.prank(address(0x123)); graph.revokeMandate(3);
        _assertAccounting(1, 5_000_000, 0, 1_500_000);
        usdc.mint(address(0x124), 1_500_000);
        vm.prank(address(0x124)); usdc.approve(address(graph), type(uint256).max);
        vm.prank(address(0x124)); graph.executePayment(4, _id(4, VENDOR, 1_500_000, 1, keccak256("sibling-stays-live"), deadline, 61), VENDOR, 1_500_000, 1, keccak256("sibling-stays-live"), deadline, 61, keccak256("outcome"));
        _assertAccounting(1, 5_000_000, 1_500_000, 0);
    }
    function testNestedAllocationLeavesOnlyRootUnreservedRemainderSpendable() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 2_000_000, deadline, 1, address(0));
        vm.prank(address(0x123)); graph.delegate(3, address(0x124), 1_000_000, deadline, 1, address(0));
        usdc.mint(RESEARCH, 3_000_000);
        vm.prank(RESEARCH); usdc.approve(address(graph), type(uint256).max);
        vm.prank(RESEARCH); graph.executePayment(1, _id(1, VENDOR, 3_000_000, 1, keccak256("root-remainder"), deadline, 62), VENDOR, 3_000_000, 1, keccak256("root-remainder"), deadline, 62, keccak256("outcome"));
        _assertAccounting(1, 5_000_000, 3_000_000, 2_000_000);
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.BudgetExceeded.selector));
        graph.executePayment(1, _id(1, VENDOR, 1, 1, keccak256("root-overrun"), deadline, 63), VENDOR, 1, 1, keccak256("root-overrun"), deadline, 63, keccak256("outcome"));
    }
    function testNestedReleaseAllowsRedelegationWithoutCreatingAuthority() public {
        vm.prank(TRANSLATOR); graph.revokeMandate(2);
        vm.prank(RESEARCH); graph.delegate(1, address(0x123), 2_000_000, deadline, 1, address(0));
        vm.prank(address(0x123)); graph.delegate(3, address(0x124), 1_000_000, deadline, 1, address(0));
        vm.prank(address(0x124)); graph.revokeMandate(4);
        vm.prank(address(0x123)); graph.revokeMandate(3);
        vm.prank(RESEARCH); graph.delegate(1, address(0x125), 5_000_000, deadline, 1, address(0));
        _assertAccounting(1, 5_000_000, 0, 5_000_000);
        usdc.mint(RESEARCH, 1);
        vm.prank(RESEARCH); usdc.approve(address(graph), type(uint256).max);
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.BudgetExceeded.selector));
        graph.executePayment(1, _id(1, VENDOR, 1, 1, keccak256("cycle-overrun"), deadline, 64), VENDOR, 1, 1, keccak256("cycle-overrun"), deadline, 64, keccak256("outcome"));
    }
    function testSmallestValidPaymentAndZeroPayment() public {
        vm.prank(TRANSLATOR); usdc.mint(TRANSLATOR, 1);
        vm.prank(TRANSLATOR); graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("one"), deadline, 46), VENDOR, 1, 1, keccak256("one"), deadline, 46, keccak256("o"));
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.BudgetExceeded.selector));
        graph.executePayment(2, _id(2, VENDOR, 0, 1, keccak256("zero"), deadline, 47), VENDOR, 0, 1, keccak256("zero"), deadline, 47, keccak256("o"));
    }

    function testCareerAuthorityAndStopBlockPayment() public {
        uint256 agentId = 7;
        identity.mint(HUMAN, agentId);
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(CAREER_AGENT, agentId, MandateGraph.Career.Trainee, 200_000);
        vm.prank(HUMAN); graph.registerAgent(CAREER_AGENT, agentId, 200_000);
        vm.prank(RESEARCH); uint256 mandateId = graph.delegate(1, CAREER_AGENT, 1_000_000, deadline, 1, address(0));
        usdc.mint(CAREER_AGENT, 1_000_000);
        vm.prank(CAREER_AGENT); usdc.approve(address(graph), type(uint256).max);

        bytes32 firstProof = keccak256("proof");
        bytes32 firstPayment = _id(mandateId, VENDOR, 200_000, 1, keccak256("career"), deadline, 31);
        vm.prank(CAREER_AGENT);
        graph.executePayment(mandateId, firstPayment, VENDOR, 200_000, 1, keccak256("career"), deadline, 31, firstProof);
        vm.expectEmit(true, true, true, true);
        emit WorkProofRecorded(CAREER_AGENT, taskId, firstPayment, firstProof, 1);
        vm.prank(HUMAN); graph.recordWorkProof(CAREER_AGENT, taskId, firstPayment, firstProof);
        require(graph.isPromotionEligible(CAREER_AGENT), "promotion should be eligible");

        vm.prank(HUMAN); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidPromotion.selector));
        graph.promoteAgent(CAREER_AGENT, MandateGraph.Career.Director, 1_000_000);
        vm.expectEmit(true, false, false, true);
        emit Promotion(CAREER_AGENT, MandateGraph.Career.Trainee, MandateGraph.Career.Associate, 1_000_000);
        vm.prank(HUMAN); graph.promoteAgent(CAREER_AGENT, MandateGraph.Career.Associate, 1_000_000);
        require(!graph.isPromotionEligible(CAREER_AGENT), "proof must be consumed by promotion");

        bytes32 secondProof = keccak256("proof-2");
        vm.prank(CAREER_AGENT);
        graph.executePayment(mandateId, _id(mandateId, VENDOR, 800_000, 1, keccak256("larger"), deadline, 32), VENDOR, 800_000, 1, keccak256("larger"), deadline, 32, secondProof);
        bytes32 reason = keccak256("policy-violation");
        vm.expectEmit(true, false, false, true);
        emit Demotion(CAREER_AGENT, MandateGraph.Career.Associate, MandateGraph.Career.Trainee, 500_000, reason);
        vm.prank(HUMAN); graph.demoteAgent(CAREER_AGENT, reason);
        (, MandateGraph.Career career, uint128 authorityCap,, uint32 violations,) = graph.agents(CAREER_AGENT);
        require(career == MandateGraph.Career.Trainee && authorityCap == 500_000 && violations == 1, "demotion state mismatch");
        require(!graph.isAuthorized(mandateId), "STOP must disable mandate authorization");
        vm.prank(CAREER_AGENT); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AgentStopped.selector));
        graph.executePayment(mandateId, _id(mandateId, VENDOR, 1, 1, keccak256("blocked"), deadline, 33), VENDOR, 1, 1, keccak256("blocked"), deadline, 33, keccak256("proof-3"));
        vm.prank(HUMAN); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AgentStopped.selector));
        graph.promoteAgent(CAREER_AGENT, MandateGraph.Career.Associate, 1_000_000);
        vm.prank(HUMAN); graph.reinstateAgent(CAREER_AGENT, keccak256("remediation"));
        require(!graph.isPromotionEligible(CAREER_AGENT), "pre-violation proof must not unlock promotion");
        vm.prank(CAREER_AGENT); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AuthorityCapExceeded.selector));
        graph.executePayment(mandateId, _id(mandateId, VENDOR, 500_001, 1, keccak256("cap-after-demotion"), deadline, 39), VENDOR, 500_001, 1, keccak256("cap-after-demotion"), deadline, 39, keccak256("proof-4"));
    }

    function testRegisteredAgentCannotExceedAuthorityCap() public {
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AuthorityCapExceeded.selector));
        graph.executePayment(2, _id(2, VENDOR, 1_000_001, 1, keccak256("cap"), deadline, 34), VENDOR, 1_000_001, 1, keccak256("cap"), deadline, 34, keccak256("proof"));
    }

    function testParentAuthorityCapAndStopCascadeToChild() public {
        vm.prank(HUMAN); graph.demoteAgent(RESEARCH, keccak256("root-violation"));
        vm.prank(TRANSLATOR); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AgentStopped.selector));
        graph.executePayment(2, _id(2, VENDOR, 1, 1, keccak256("root-stop"), deadline, 35), VENDOR, 1, 1, keccak256("root-stop"), deadline, 35, keccak256("proof"));
    }

    function testAncestorAuthorityCapConstrainsChildPayment() public {
        MockUSDC isolatedToken = new MockUSDC();
        MockIdentityRegistry isolatedIdentity = new MockIdentityRegistry();
        MandateGraph isolated = new MandateGraph(isolatedToken, isolatedIdentity);
        address parentAgent = address(0xABCD);
        address childAgent = address(0xDCBA);
        isolatedIdentity.mint(HUMAN, 1); isolatedIdentity.mint(HUMAN, 2);
        vm.prank(HUMAN); isolated.registerAgent(parentAgent, 1, 100);
        vm.prank(HUMAN); isolated.registerAgent(childAgent, 2, 200);
        bytes32 isolatedTask = keccak256("ancestor-cap");
        uint64 isolatedDeadline = uint64(block.timestamp + 1 days);
        vm.prank(HUMAN); isolated.createTask(isolatedTask, keccak256("metadata"), 500, isolatedDeadline, 1, parentAgent, address(0), 1);
        vm.prank(parentAgent); isolated.delegate(1, childAgent, 500, isolatedDeadline, 1, address(0));
        isolatedToken.mint(childAgent, 500);
        vm.prank(childAgent); isolatedToken.approve(address(isolated), type(uint256).max);
        bytes32 paymentId = keccak256(abi.encode(isolatedTask, 2, VENDOR, uint128(101), uint256(1), keccak256("resource"), isolatedDeadline, uint256(1)));
        vm.prank(childAgent); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AuthorityCapExceeded.selector));
        isolated.executePayment(2, paymentId, VENDOR, 101, 1, keccak256("resource"), isolatedDeadline, 1, keccak256("outcome"));
    }

    function testAgentAdministrationAccessControlAndRegistrationBoundary() public {
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.NotAgentOwner.selector));
        graph.demoteAgent(TRANSLATOR, keccak256("unauthorized"));
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.NotAgentOwner.selector));
        graph.promoteAgent(TRANSLATOR, MandateGraph.Career.Associate, 2_000_000);
        vm.prank(HUMAN); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AgentAlreadyRegistered.selector));
        graph.registerAgent(TRANSLATOR, 2, 1);
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.UnknownAgent.selector));
        graph.delegate(1, address(0x999), 1, deadline, 1, address(0));
    }

    function testIdentityOwnershipPreventsRegistrationFrontRunningAndReuse() public {
        identity.mint(HUMAN, 9);
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.NotAgentOwner.selector));
        graph.registerAgent(address(0x901), 9, 100);
        vm.prank(HUMAN); graph.registerAgent(address(0x901), 9, 100);
        vm.prank(HUMAN); vm.expectRevert(abi.encodeWithSelector(MandateGraph.IdentityAlreadyRegistered.selector, 9));
        graph.registerAgent(address(0x902), 9, 100);
        vm.prank(HUMAN); vm.expectRevert(abi.encodeWithSelector(MandateGraph.UnknownAgent.selector));
        graph.registerAgent(address(0x903), 404, 100);
    }

    function testTransferredIdentityMovesAdministrationRights() public {
        identity.mint(HUMAN, 10);
        vm.prank(HUMAN); graph.registerAgent(CAREER_AGENT, 10, 100);
        vm.prank(HUMAN); identity.transfer(10, RESEARCH);
        vm.prank(HUMAN); vm.expectRevert(abi.encodeWithSelector(MandateGraph.NotAgentOwner.selector));
        graph.demoteAgent(CAREER_AGENT, keccak256("old-owner"));
        vm.prank(RESEARCH); graph.demoteAgent(CAREER_AGENT, keccak256("new-owner"));
        require(graph.stoppedAgents(CAREER_AGENT), "new ERC-8004 owner did not gain administration");
    }

    function testStoppedAgentCannotReceiveNewMandate() public {
        vm.prank(HUMAN); graph.demoteAgent(TRANSLATOR, keccak256("stop"));
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AgentStopped.selector));
        graph.delegate(1, TRANSLATOR, 1, deadline, 1, address(0));
        vm.prank(HUMAN); vm.expectRevert(abi.encodeWithSelector(MandateGraph.AgentStopped.selector));
        graph.createTask(keccak256("stopped-task"), keccak256("metadata"), 1, deadline, 1, TRANSLATOR, address(0), 0);
    }

    function testWorkProofRequiresSuccessfulBoundPaymentAndCannotReplay() public {
        bytes32 paymentId = _id(2, VENDOR, 1, 1, keccak256("work"), deadline, 36);
        bytes32 proof = keccak256("work-proof");
        vm.prank(HUMAN); vm.expectRevert(abi.encodeWithSelector(MandateGraph.InvalidOutcome.selector));
        graph.recordWorkProof(TRANSLATOR, taskId, paymentId, proof);
        vm.prank(TRANSLATOR);
        graph.executePayment(2, paymentId, VENDOR, 1, 1, keccak256("work"), deadline, 36, proof);
        vm.prank(RESEARCH); vm.expectRevert(abi.encodeWithSelector(MandateGraph.NotTaskOwner.selector));
        graph.recordWorkProof(TRANSLATOR, taskId, paymentId, proof);
        vm.prank(HUMAN); graph.recordWorkProof(TRANSLATOR, taskId, paymentId, proof);
        vm.prank(HUMAN); vm.expectRevert(abi.encodeWithSelector(MandateGraph.WorkProofAlreadyRecorded.selector, paymentId));
        graph.recordWorkProof(TRANSLATOR, taskId, paymentId, proof);
    }

    function testChildSpendConvertsReservationWithoutDoubleCounting() public {
        vm.prank(TRANSLATOR);
        graph.executePayment(2, _id(2, VENDOR, 1_000_000, 1, keccak256("child-full"), deadline, 37), VENDOR, 1_000_000, 1, keccak256("child-full"), deadline, 37, keccak256("proof"));
        (,,,,,uint128 rootSpent,uint128 rootAllocated,,,,,) = graph.mandates(1);
        require(rootSpent == 1_000_000 && rootAllocated == 0, "parent reservation was double counted");
        usdc.mint(RESEARCH, 4_000_000);
        vm.prank(RESEARCH); usdc.approve(address(graph), type(uint256).max);
        vm.prank(RESEARCH);
        graph.executePayment(1, _id(1, VENDOR, 4_000_000, 1, keccak256("root-rest"), deadline, 38), VENDOR, 4_000_000, 1, keccak256("root-rest"), deadline, 38, keccak256("proof-2"));
    }

    function testFuzzChildPaymentMaintainsBudgetConservation(uint128 rawAmount) public {
        uint128 amount = uint128((uint256(rawAmount) % 1_000_000) + 1);
        vm.prank(TRANSLATOR);
        graph.executePayment(2, _id(2, VENDOR, amount, 1, keccak256("fuzz-child"), deadline, 40), VENDOR, amount, 1, keccak256("fuzz-child"), deadline, 40, keccak256("fuzz-proof"));
        (, uint128 taskBudget, uint128 taskSpent,,,) = graph.tasks(taskId);
        (,,,,,uint128 rootSpent,uint128 rootAllocated,,,,,) = graph.mandates(1);
        (,,,,uint128 childBudget,uint128 childSpent,uint128 childAllocated,,,,,) = graph.mandates(2);
        require(taskSpent == amount && taskSpent <= taskBudget, "task budget invariant failed");
        require(rootSpent == amount && rootSpent + rootAllocated <= 5_000_000, "root budget invariant failed");
        require(childSpent == amount && childAllocated == 0 && childSpent <= childBudget, "child budget invariant failed");
    }

    function testTransferFailureRollsBackAllPaymentState() public {
        FalseReturnUSDC falseToken = new FalseReturnUSDC();
        MockIdentityRegistry isolatedIdentity = new MockIdentityRegistry();
        MandateGraph isolated = new MandateGraph(falseToken, isolatedIdentity);
        isolatedIdentity.mint(address(this), 1); isolated.registerAgent(address(this), 1, 100);
        bytes32 isolatedTask = keccak256("isolated-task");
        uint64 isolatedDeadline = uint64(block.timestamp + 1 days);
        isolated.createTask(isolatedTask, keccak256("metadata"), 100, isolatedDeadline, 1, address(this), address(0), 0);
        bytes32 paymentId = keccak256(abi.encode(isolatedTask, 1, VENDOR, uint128(10), uint256(1), keccak256("resource"), isolatedDeadline, uint256(1)));
        vm.expectRevert(abi.encodeWithSelector(MandateGraph.UsdcTransferFailed.selector));
        isolated.executePayment(1, paymentId, VENDOR, 10, 1, keccak256("resource"), isolatedDeadline, 1, keccak256("outcome"));
        require(!isolated.usedPaymentIds(paymentId), "failed payment id persisted");
        require(isolated.paymentRequestHashes(paymentId) == bytes32(0), "failed request hash persisted");
        require(isolated.paymentOutcomeHashes(paymentId) == bytes32(0), "failed outcome hash persisted");
        require(isolated.paymentMandateIds(paymentId) == 0, "failed mandate binding persisted");
        (, , uint128 taskSpent, , , ) = isolated.tasks(isolatedTask);
        (,,,,,uint128 mandateSpent,,,,,,) = isolated.mandates(1);
        require(taskSpent == 0 && mandateSpent == 0, "failed payment spend persisted");
    }

    function testReentrancyIsRejectedWithoutBreakingOuterPayment() public {
        ReentrantUSDC reentrantToken = new ReentrantUSDC();
        MockIdentityRegistry isolatedIdentity = new MockIdentityRegistry();
        MandateGraph isolated = new MandateGraph(reentrantToken, isolatedIdentity);
        isolatedIdentity.mint(address(this), 1); isolated.registerAgent(address(this), 1, 100);
        bytes32 isolatedTask = keccak256("reentrant-task");
        uint64 isolatedDeadline = uint64(block.timestamp + 1 days);
        isolated.createTask(isolatedTask, keccak256("metadata"), 100, isolatedDeadline, 1, address(this), address(0), 0);
        bytes32 paymentId = keccak256(abi.encode(isolatedTask, 1, VENDOR, uint128(10), uint256(1), keccak256("resource"), isolatedDeadline, uint256(1)));
        bytes memory payload = abi.encodeCall(isolated.executePayment, (1, paymentId, VENDOR, 10, 1, keccak256("resource"), isolatedDeadline, 1, keccak256("outcome")));
        reentrantToken.configure(address(isolated), payload);
        isolated.executePayment(1, paymentId, VENDOR, 10, 1, keccak256("resource"), isolatedDeadline, 1, keccak256("outcome"));
        require(reentrantToken.attempted() && !reentrantToken.reentrySucceeded(), "reentry unexpectedly succeeded");
        require(reentrantToken.reentryError() == MandateGraph.ReentrantCall.selector, "wrong reentry failure");
    }

    function testCrossFunctionReentrancyIsRejected() public {
        ReentrantUSDC reentrantToken = new ReentrantUSDC();
        MockIdentityRegistry isolatedIdentity = new MockIdentityRegistry();
        MandateGraph isolated = new MandateGraph(reentrantToken, isolatedIdentity);
        isolatedIdentity.mint(address(this), 1); isolated.registerAgent(address(this), 1, 100);
        bytes32 isolatedTask = keccak256("cross-reentrant-task");
        bytes32 callbackTask = keccak256("callback-task");
        uint64 isolatedDeadline = uint64(block.timestamp + 1 days);
        isolated.createTask(isolatedTask, keccak256("metadata"), 100, isolatedDeadline, 1, address(this), address(0), 0);
        bytes32 paymentId = keccak256(abi.encode(isolatedTask, 1, VENDOR, uint128(10), uint256(1), keccak256("resource"), isolatedDeadline, uint256(1)));
        bytes memory payload = abi.encodeCall(isolated.createTask, (callbackTask, keccak256("callback"), 1, isolatedDeadline, 1, address(this), address(0), 0));
        reentrantToken.configure(address(isolated), payload);
        isolated.executePayment(1, paymentId, VENDOR, 10, 1, keccak256("resource"), isolatedDeadline, 1, keccak256("outcome"));
        require(reentrantToken.attempted() && !reentrantToken.reentrySucceeded(), "cross-function reentry unexpectedly succeeded");
        require(reentrantToken.reentryError() == MandateGraph.ReentrantCall.selector, "wrong cross-function reentry failure");
        (address callbackOwner,,,,,) = isolated.tasks(callbackTask);
        require(callbackOwner == address(0), "cross-function reentry mutated state");
    }

    event AgentRegistered(address indexed agent, uint256 indexed agentId, MandateGraph.Career career, uint128 authorityCap);
    event WorkProofRecorded(address indexed agent, bytes32 indexed taskId, bytes32 indexed paymentId, bytes32 proofHash, uint32 completedWorks);
    event Promotion(address indexed agent, MandateGraph.Career fromCareer, MandateGraph.Career toCareer, uint128 authorityCap);
    event Demotion(address indexed agent, MandateGraph.Career fromCareer, MandateGraph.Career toCareer, uint128 authorityCap, bytes32 reasonHash);
    function _id(uint256 mandateId, address recipient, uint128 amount, uint256 serviceClass, bytes32 resourceHash, uint64 requestExpiry, uint256 nonce) private view returns (bytes32) {
        return keccak256(abi.encode(taskId, mandateId, recipient, amount, serviceClass, resourceHash, requestExpiry, nonce));
    }
    function _assertAccounting(uint256 mandateId, uint128 expectedBudget, uint128 expectedSpent, uint128 expectedAllocated) private view {
        (,,,,uint128 budget, uint128 spent, uint128 allocated,,,,,) = graph.mandates(mandateId);
        require(budget == expectedBudget && spent == expectedSpent && allocated == expectedAllocated, "unexpected accounting state");
        require(budget - spent - allocated <= budget, "invalid available authority");
    }
}
