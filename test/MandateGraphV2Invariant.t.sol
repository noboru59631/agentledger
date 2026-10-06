// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MandateGraphV2, IERC20SelfCustody, IERC8004IdentityRegistryV2} from "../contracts/MandateGraphV2.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

interface InvariantVmV2 {
    function prank(address) external;
}

contract InvariantIdentityV2 is IERC8004IdentityRegistryV2 {
    mapping(uint256 => address) private owners;
    function mint(address owner, uint256 agentId) external { owners[agentId] = owner; }
    function ownerOf(uint256 agentId) external view returns (address owner) {
        owner = owners[agentId];
        require(owner != address(0), "unknown token");
    }
}

contract MandateGraphV2Handler {
    InvariantVmV2 private constant vm = InvariantVmV2(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0xA11CE);
    address private constant RECIPIENT = address(0xCAFE);

    MockUSDC public immutable token;
    MandateGraphV2 public immutable graph;
    bytes32 public immutable taskId;
    uint64 public immutable deadline;
    uint256[] private mandateIds;
    uint256 private nonce;
    uint256 private actions;

    constructor() {
        token = new MockUSDC();
        InvariantIdentityV2 identity = new InvariantIdentityV2();
        graph = new MandateGraphV2(IERC20SelfCustody(address(token)), identity);
        deadline = uint64(block.timestamp + 30 days);
        identity.mint(OWNER, 1);
        vm.prank(OWNER); graph.registerAgent(1, OWNER, 1_000_000);
        vm.prank(OWNER); (taskId,) = graph.createTask(keccak256("invariant"), keccak256("metadata"), 1_000_000, deadline, 3, 1, RECIPIENT, 8);
        mandateIds.push(1);
        token.mint(OWNER, 1_000_000_000);
        vm.prank(OWNER); token.approve(address(graph), type(uint256).max);
    }

    function step(uint256 seed, uint128 rawAmount, uint8 action) external {
        ++actions;
        uint256 parentId = mandateIds[seed % mandateIds.length];
        uint128 amount = uint128(uint256(rawAmount) % 100_001 + 1);
        if (action % 3 == 0 && mandateIds.length < 40) {
            uint256 agentId = actions + 1;
            InvariantIdentityV2(address(graph.identityRegistry())).mint(OWNER, agentId);
            vm.prank(OWNER); graph.registerAgent(agentId, OWNER, 1_000_000);
            vm.prank(OWNER);
            try graph.delegate(parentId, agentId, amount, deadline, 1, RECIPIENT) returns (uint256 childId) {
                mandateIds.push(childId);
            } catch {}
        } else if (action % 3 == 1) {
            bytes32 resourceHash = keccak256(abi.encode(seed, ++nonce));
            bytes32 paymentId = graph.computePaymentId(taskId, parentId, RECIPIENT, amount, 1, resourceHash, deadline, nonce);
            vm.prank(OWNER);
            try graph.executePayment(parentId, paymentId, RECIPIENT, amount, 1, resourceHash, deadline, nonce, keccak256("outcome")) {} catch {}
        } else {
            (,,,,,,,,,, bool revoked, uint256 activeChildren) = graph.mandates(parentId);
            if (!revoked && activeChildren == 0 && parentId != 1) {
                vm.prank(OWNER);
                try graph.revokeMandate(parentId) {} catch {}
            }
        }
    }

    function mandateCount() external view returns (uint256) { return mandateIds.length; }
    function mandateIdAt(uint256 index) external view returns (uint256) { return mandateIds[index]; }
}

contract MandateGraphV2InvariantTest {
    MandateGraphV2Handler private handler;

    function setUp() public { handler = new MandateGraphV2Handler(); }
    function targetContracts() external view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function invariantEveryMandateStaysWithinItsGrant() public view {
        for (uint256 index; index < handler.mandateCount(); ++index) {
            uint256 mandateId = handler.mandateIdAt(index);
            (,,,,uint128 budget, uint128 spent, uint128 allocated,,,,,) = handler.graph().mandates(mandateId);
            require(spent <= budget, "spent exceeds grant");
            require(allocated <= budget - spent, "reservation exceeds remainder");
        }
    }

    function invariantTaskSpendMatchesRootSpend() public view {
        bytes32 taskId = handler.taskId();
        (, , uint128 taskBudget, uint128 taskSpent, , , ) = handler.graph().tasks(taskId);
        (,,,,uint128 rootBudget, uint128 rootSpent,,,,,,) = handler.graph().mandates(1);
        require(taskSpent == rootSpent, "task and root spend diverged");
        require(taskSpent <= taskBudget && rootSpent <= rootBudget, "root overspend");
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
