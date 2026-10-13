// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MandateGraph, IERC20, IERC8004IdentityRegistry} from "../contracts/MandateGraph.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

interface LifecycleToken is IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ScriptVm {
    function envOr(string calldata, address) external returns (address);
    function envOr(string calldata, string calldata) external returns (string memory);
    function envOr(string calldata, uint256) external returns (uint256);
    function startBroadcast(address) external;
    function stopBroadcast() external;
    function projectRoot() external view returns (string memory);
    function writeFile(string calldata, string calldata) external;
}

contract LifecycleIdentityRegistry is IERC8004IdentityRegistry {
    mapping(uint256 => address) private owners;
    function mint(address owner, uint256 agentId) external { owners[agentId] = owner; }
    function ownerOf(uint256 agentId) external view returns (address owner) {
        owner = owners[agentId];
        require(owner != address(0), "unknown token");
    }
}

contract LifecycleScript {
    ScriptVm private constant vm = ScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;
    IERC8004IdentityRegistry private constant ARC_TESTNET_IDENTITY = IERC8004IdentityRegistry(0x8004A818BFB912233c491871b3d84c89A494BD9e);

    event LifecycleEvidence(string mode, address contractAddress, bytes32 taskId, uint256 rootMandateId, uint256 childMandateId, bytes32 paymentId, bytes32 outcomeHash, bool retryBlocked);

    function run() external {
        string memory mode = vm.envOr("LIFECYCLE_MODE", string("local"));
        bool localMode = _validateMode(mode, vm.envOr("LIFECYCLE_RPC_URL", string("")));
        address deployer = vm.envOr("LIFECYCLE_SENDER", address(0));
        require(deployer != address(0), "set LIFECYCLE_SENDER");
        address recipient = vm.envOr("LIFECYCLE_RECIPIENT", deployer);
        uint256 agentId = vm.envOr("ERC8004_AGENT_ID", type(uint256).max);
        uint64 deadline = uint64(block.timestamp + 1 days);
        bytes32 taskId = keccak256(abi.encode("AgentLedger lifecycle", block.chainid, deployer, block.timestamp));

        vm.startBroadcast(deployer);
        (MandateGraph graph, LifecycleToken token, uint256 effectiveAgentId) = _deployGraph(localMode, deployer, agentId);
        graph.registerAgent(deployer, effectiveAgentId, 1_000_000);
        graph.createTask(taskId, keccak256("local lifecycle task metadata"), 1_000_000, deadline, 3, deployer, address(0), 1);
        uint256 childId = graph.delegate(1, deployer, 500_000, deadline, 1, recipient);
        token.approve(address(graph), type(uint256).max);
        (bytes32 paymentId, bytes32 outcomeHash) = _settlePayment(graph, childId, taskId, recipient, deadline);
        graph.revokeTask(taskId);
        vm.stopBroadcast();
        bool retryBlocked = _retryBlocked(graph, childId, recipient, deadline);
        require(retryBlocked, "revoked retry unexpectedly succeeded");
        emit LifecycleEvidence(mode, address(graph), taskId, 1, childId, paymentId, outcomeHash, retryBlocked);

        string memory evidence = string.concat(
            '{"mode":"', mode,
            '","chainId":', _uint(block.chainid),
            ',"contract":"', _address(address(graph)),
            '","taskId":"', _hex32(taskId),
            '","rootMandateId":1,"childMandateId":', _uint(childId),
            ',"paymentId":"', _hex32(paymentId),
            '","outcomeHash":"', _hex32(outcomeHash),
            '","revoke":"confirmed","retryBlocked":true}'
        );
        vm.writeFile(string.concat(vm.projectRoot(), "/lifecycle-evidence.json"), evidence);
    }

    function _validateMode(string memory mode, string memory rpcUrl) private view returns (bool localMode) {
        localMode = keccak256(bytes(mode)) == keccak256(bytes("local"));
        bool arcTestnetMode = keccak256(bytes(mode)) == keccak256(bytes("arc-testnet"));
        require(localMode || arcTestnetMode, "unsupported lifecycle mode");
        if (localMode) {
            require(bytes(rpcUrl).length == 0 || keccak256(bytes(rpcUrl)) == keccak256(bytes("http://127.0.0.1:8545")), "local mode requires Anvil RPC");
            require(block.chainid == 31337, "local mode requires Anvil chain ID 31337");
        } else {
            require(bytes(rpcUrl).length != 0, "set LIFECYCLE_RPC_URL");
            require(block.chainid == 5042002, "Arc testnet chain ID mismatch");
        }
    }

    function _deployGraph(bool localMode, address deployer, uint256 agentId)
        private returns (MandateGraph graph, LifecycleToken token, uint256 effectiveAgentId)
    {
        IERC8004IdentityRegistry identityRegistry;
        effectiveAgentId = agentId;
        if (localMode) {
            MockUSDC mockToken = new MockUSDC();
            token = LifecycleToken(address(mockToken));
            mockToken.mint(deployer, 1_000_000);
            LifecycleIdentityRegistry mockIdentity = new LifecycleIdentityRegistry();
            effectiveAgentId = 1;
            mockIdentity.mint(deployer, effectiveAgentId);
            identityRegistry = mockIdentity;
        } else {
            require(ARC_TESTNET_USDC.code.length != 0, "Arc testnet USDC has no code");
            require(address(ARC_TESTNET_IDENTITY).code.length != 0, "Arc testnet Identity Registry has no code");
            require(effectiveAgentId != type(uint256).max, "set ERC8004_AGENT_ID");
            require(ARC_TESTNET_IDENTITY.ownerOf(effectiveAgentId) == deployer, "sender does not own ERC8004 agentId");
            token = LifecycleToken(ARC_TESTNET_USDC);
            identityRegistry = ARC_TESTNET_IDENTITY;
        }
        graph = new MandateGraph(token, identityRegistry);
    }

    function _settlePayment(MandateGraph graph, uint256 childId, bytes32 taskId, address recipient, uint64 deadline) private returns (bytes32 paymentId, bytes32 outcomeHash) {
        bytes32 resourceHash = keccak256("local lifecycle request");
        outcomeHash = keccak256("local lifecycle outcome");
        uint256 nonce = 1;
        paymentId = keccak256(abi.encode(taskId, childId, recipient, uint128(10_000), uint256(1), resourceHash, deadline, nonce));
        graph.executePayment(childId, paymentId, recipient, 10_000, 1, resourceHash, deadline, nonce, outcomeHash);
    }

    function _retryBlocked(MandateGraph graph, uint256 childId, address recipient, uint64 deadline) private returns (bool) {
        bytes32 resourceHash = keccak256("local lifecycle request");
        try graph.executePayment(childId, keccak256("blocked retry"), recipient, 1, 1, resourceHash, deadline, 2, keccak256("retry")) {
            return false;
        } catch {
            return true;
        }
    }

    function _uint(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 copy = value;
        uint256 digits;
        while (copy != 0) { ++digits; copy /= 10; }
        bytes memory result = new bytes(digits);
        while (value != 0) { result[--digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(result);
    }

    function _address(address value) private pure returns (string memory) {
        return _hex(abi.encodePacked(value));
    }

    function _hex32(bytes32 value) private pure returns (string memory) {
        return _hex(abi.encodePacked(value));
    }

    function _hex(bytes memory value) private pure returns (string memory) {
        bytes16 symbols = "0123456789abcdef";
        bytes memory result = new bytes(2 + value.length * 2);
        result[0] = "0";
        result[1] = "x";
        for (uint256 index; index < value.length; ++index) {
            result[2 + index * 2] = symbols[uint8(value[index] >> 4)];
            result[3 + index * 2] = symbols[uint8(value[index] & 0x0f)];
        }
        return string(result);
    }
}
