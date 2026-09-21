// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MandateGraph, IERC20} from "../contracts/MandateGraph.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

interface LifecycleToken is IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ScriptVm {
    function envOr(string calldata, address) external returns (address);
    function envOr(string calldata, string calldata) external returns (string memory);
    function startBroadcast(address) external;
    function stopBroadcast() external;
    function projectRoot() external view returns (string memory);
    function writeFile(string calldata, string calldata) external;
}

contract LifecycleScript {
    ScriptVm private constant vm = ScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;

    event LifecycleEvidence(string mode, address contractAddress, bytes32 taskId, uint256 rootMandateId, uint256 childMandateId, bytes32 paymentId, bytes32 outcomeHash, bool retryBlocked);

    function run() external {
        string memory mode = vm.envOr("LIFECYCLE_MODE", string("local"));
        string memory rpcUrl = vm.envOr("LIFECYCLE_RPC_URL", string(""));
        bool localMode = keccak256(bytes(mode)) == keccak256(bytes("local"));
        bool arcTestnetMode = keccak256(bytes(mode)) == keccak256(bytes("arc-testnet"));
        require(localMode || arcTestnetMode, "unsupported lifecycle mode");
        if (localMode) {
            require(bytes(rpcUrl).length == 0 || keccak256(bytes(rpcUrl)) == keccak256(bytes("http://127.0.0.1:8545")), "local mode requires Anvil RPC");
            require(block.chainid == 31337, "local mode requires Anvil chain ID 31337");
        } else {
            require(bytes(rpcUrl).length != 0, "set LIFECYCLE_RPC_URL");
            require(block.chainid == 5042002, "Arc testnet chain ID mismatch");
        }
        address deployer = vm.envOr("LIFECYCLE_SENDER", address(0));
        require(deployer != address(0), "set LIFECYCLE_SENDER");
        address recipient = vm.envOr("LIFECYCLE_RECIPIENT", deployer);
        LifecycleToken token;
        uint64 deadline = uint64(block.timestamp + 1 days);
        bytes32 taskId = keccak256(abi.encode("AgentLedger lifecycle", block.chainid, address(this), block.timestamp));
        bytes32 outcomeHash = keccak256("local lifecycle outcome");

        vm.startBroadcast(deployer);
        if (localMode) {
            MockUSDC mockToken = new MockUSDC();
            token = LifecycleToken(address(mockToken));
            mockToken.mint(deployer, 1_000_000);
        } else {
            require(ARC_TESTNET_USDC.code.length != 0, "Arc testnet USDC has no code");
            token = LifecycleToken(ARC_TESTNET_USDC);
        }
        MandateGraph graph = new MandateGraph(token);
        graph.createTask(taskId, keccak256("local lifecycle task metadata"), 1_000_000, deadline, 3, deployer, address(0), 1);
        uint256 childId = graph.delegate(1, deployer, 500_000, deadline, 1, recipient);
        token.approve(address(graph), type(uint256).max);
        bytes32 resourceHash = keccak256("local lifecycle request");
        uint256 nonce = 1;
        bytes32 paymentId = keccak256(abi.encode(taskId, childId, recipient, uint128(10_000), uint256(1), resourceHash, deadline, nonce));
        graph.executePayment(childId, paymentId, recipient, 10_000, 1, resourceHash, deadline, nonce, outcomeHash);
        graph.revokeTask(taskId);
        bool retryBlocked;
        try graph.executePayment(childId, keccak256("blocked retry"), recipient, 1, 1, resourceHash, deadline, 2, keccak256("retry")) {
            retryBlocked = false;
        } catch { retryBlocked = true; }
        require(retryBlocked, "revoked retry unexpectedly succeeded");
        emit LifecycleEvidence(mode, address(graph), taskId, 1, childId, paymentId, outcomeHash, retryBlocked);
        vm.stopBroadcast();

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
