// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MandateGraph} from "../contracts/MandateGraph.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

interface InvariantVm {
    function prank(address) external;
    function warp(uint256) external;
}

contract MandateGraphHandler {
    InvariantVm private constant vm = InvariantVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0xA11CE);
    address private constant AGENT = address(0xB0B);
    address private constant RECIPIENT = address(0xCAFE);
    MockUSDC public immutable token;
    MandateGraph public immutable graph;
    bytes32 public immutable taskId;
    uint64 public immutable deadline;
    uint256[] private mandateIds;
    mapping(uint256 => address) private agents;
    uint256 private nonce;
    uint256 private actions;

    constructor() {
        token = new MockUSDC();
        graph = new MandateGraph(token);
        taskId = keccak256("invariant-task");
        deadline = uint64(block.timestamp + 30 days);
        vm.prank(OWNER);
        graph.createTask(taskId, keccak256("metadata"), 1_000_000, deadline, 3, AGENT, address(0), 8);
        mandateIds.push(1);
        agents[1] = AGENT;
        token.mint(AGENT, 1_000_000_000);
        vm.prank(AGENT);
        token.approve(address(graph), type(uint256).max);
    }

    function step(uint256 seed, uint128 rawAmount, uint8 action) external {
        ++actions;
        if (block.timestamp >= deadline) vm.warp(uint256(deadline) - 1);
        uint256 parentIndex = seed % mandateIds.length;
        uint256 parentId = mandateIds[parentIndex];
        address parentAgent = agents[parentId];
        uint128 amount = uint128(uint256(rawAmount) % 100_001 + 1);
        if (action % 4 == 0 && mandateIds.length < 40) {
            vm.prank(parentAgent);
            try graph.delegate(parentId, address(uint160(0x1000 + mandateIds.length)), amount, deadline, 1, address(0)) returns (uint256 childId) {
                mandateIds.push(childId);
                agents[childId] = address(uint160(0x1000 + mandateIds.length - 1));
                token.mint(agents[childId], 1_000_000_000);
                vm.prank(agents[childId]); token.approve(address(graph), type(uint256).max);
            } catch {}
        } else if (action % 4 == 1) {
            bytes32 resourceHash = keccak256(abi.encode(seed, ++nonce));
            bytes32 paymentId = keccak256(abi.encode(taskId, parentId, RECIPIENT, amount, 1, resourceHash, deadline, nonce));
            vm.prank(parentAgent);
            try graph.executePayment(parentId, paymentId, RECIPIENT, amount, 1, resourceHash, deadline, nonce, keccak256("outcome")) {} catch {}
        } else if (action % 4 == 2) {
            (,,,,,,,,,, bool revoked, uint256 activeChildren) = graph.mandates(parentId);
            if (!revoked && activeChildren == 0 && parentId != 1) {
                vm.prank(parentAgent);
                try graph.revokeMandate(parentId) {} catch {}
            }
        }
    }

    function mandateCount() external view returns (uint256) { return mandateIds.length; }
    function mandateIdAt(uint256 index) external view returns (uint256) { return mandateIds[index]; }
    function actionCount() external view returns (uint256) { return actions; }
}

contract MandateGraphInvariantTest {
    InvariantVm private constant vm = InvariantVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MandateGraphHandler private handler;

    function setUp() public {
        handler = new MandateGraphHandler();
    }

    function targetContracts() external view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function invariantHandlerExecutesActions() public view {
        require(handler.actionCount() > 0, "stateful handler did not run");
    }

    function invariantEveryMandateStaysWithinItsGrant() public view {
        for (uint256 index; index < handler.mandateCount(); ++index) {
            uint256 mandateId = handler.mandateIdAt(index);
            (,,,,uint128 budget, uint128 spent, uint128 allocated,,,,,) = handler.graph().mandates(mandateId);
            require(spent <= budget, "spent exceeds grant");
            require(allocated <= budget - spent, "reservation exceeds remainder");
        }
    }

    function invariantTaskSpendStaysWithinRootGrant() public view {
        (,,,,uint128 rootBudget, uint128 rootSpent,,,,,,) = handler.graph().mandates(1);
        require(rootSpent <= rootBudget, "root overspend");
    }

    function invariantTaskSpendMatchesRootSpend() public view {
        (, , uint128 taskSpent, , , ) = handler.graph().tasks(handler.taskId());
        (,,,,,uint128 rootSpent,,,,,,) = handler.graph().mandates(1);
        require(taskSpent == rootSpent, "task and root spend diverged");
    }

    function invariantDelegationAttenuationNeverWidens() public view {
        for (uint256 index = 1; index < handler.mandateCount(); ++index) {
            uint256 mandateId = handler.mandateIdAt(index);
            (, uint256 parentId, , address recipient, , , , uint64 expiry, uint8 depth, uint256 scope, , ) = handler.graph().mandates(mandateId);
            (, , , address parentRecipient, , , , uint64 parentExpiry, uint8 parentDepth, uint256 parentScope, , ) = handler.graph().mandates(parentId);
            require((scope | parentScope) == parentScope, "scope widened");
            require(expiry <= parentExpiry, "expiry widened");
            require(depth < parentDepth, "depth widened");
            require(parentRecipient == address(0) || recipient == parentRecipient, "recipient widened");
        }
    }
}
