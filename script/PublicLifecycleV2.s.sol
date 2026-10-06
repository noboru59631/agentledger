// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MandateGraphV2, IERC20SelfCustody, IERC8004IdentityRegistryV2} from "../contracts/MandateGraphV2.sol";

interface LifecycleTokenV2 is IERC20SelfCustody {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface ScriptVmV2 {
    function envOr(string calldata, address) external returns (address);
    function envOr(string calldata, uint256) external returns (uint256);
    function startBroadcast(address) external;
    function stopBroadcast() external;
    function prank(address) external;
    function projectRoot() external view returns (string memory);
    function writeFile(string calldata, string calldata) external;
}

contract PublicLifecycleV2Script {
    ScriptVmV2 private constant vm = ScriptVmV2(address(uint160(uint256(keccak256("hevm cheat code")))));
    LifecycleTokenV2 private constant USDC = LifecycleTokenV2(0x3600000000000000000000000000000000000000);
    IERC8004IdentityRegistryV2 private constant IDENTITY = IERC8004IdentityRegistryV2(0x8004A818BFB912233c491871b3d84c89A494BD9e);
    uint256 private constant ARC_TESTNET_CHAIN_ID = 5_042_002;

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "Arc testnet only");
        address owner = vm.envOr("LIFECYCLE_SENDER", address(0));
        address recipient = vm.envOr("LIFECYCLE_RECIPIENT", address(0));
        uint256 agentId = vm.envOr("ERC8004_AGENT_ID", type(uint256).max);
        require(owner != address(0) && recipient != address(0) && recipient != owner, "set distinct sender and recipient");
        require(agentId != type(uint256).max && IDENTITY.ownerOf(agentId) == owner, "sender must own agentId");
        require(USDC.balanceOf(owner) >= 25_000, "need at least 0.025 testnet USDC");

        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.startBroadcast(owner);
        MandateGraphV2 graph = new MandateGraphV2(IERC20SelfCustody(address(USDC)), IDENTITY);
        graph.registerAgent(agentId, owner, 10_000);
        (bytes32 taskId, uint256 rootMandateId) = _createTask(graph, owner, recipient, agentId, deadline);
        require(USDC.approve(address(graph), 25_000), "exact approval failed");
        _completeFirstWork(graph, agentId, taskId, rootMandateId, recipient, deadline);
        graph.promoteAgent(agentId, MandateGraphV2.Career.Associate, 50_000);
        _completeSecondWork(graph, taskId, rootMandateId, recipient, deadline);
        graph.demoteAgent(agentId, keccak256("testnet-v2-violation"));
        require(!graph.isAuthorized(rootMandateId), "STOP did not block authority");
        graph.reinstateAgent(agentId, keccak256("testnet-v2-remediation"));
        vm.stopBroadcast();

        (, MandateGraphV2.Career career, uint128 cap, uint32 completedWorks, uint32 violations, bool registered) = graph.agents(agentId);
        require(registered && career == MandateGraphV2.Career.Trainee, "career state mismatch");
        require(cap == 25_000 && completedWorks == 1 && violations == 1, "authority state mismatch");
        require(!graph.stoppedAgents(agentId) && graph.isAuthorized(rootMandateId), "reinstatement state mismatch");
        require(USDC.allowance(owner, address(graph)) == 0, "allowance not fully consumed");

        _assertOverCapSimulation(graph, owner, taskId, rootMandateId, recipient, deadline);

        if (vm.envOr("WRITE_TESTNET_V2_EVIDENCE", uint256(0)) == 1) {
            _writeEvidence(graph, owner, recipient, agentId, taskId, rootMandateId);
        }
    }

    function _createTask(MandateGraphV2 graph, address owner, address recipient, uint256 agentId, uint64 deadline)
        private returns (bytes32 taskId, uint256 rootMandateId)
    {
        bytes32 salt = keccak256(abi.encode("AgentLedger public V2", owner, block.timestamp));
        return graph.createTask(
            salt,
            keccak256("AgentLedger public self-custodial testnet task"),
            100_000,
            deadline,
            3,
            agentId,
            recipient,
            0
        );
    }

    function _completeFirstWork(
        MandateGraphV2 graph,
        uint256 agentId,
        bytes32 taskId,
        uint256 mandateId,
        address recipient,
        uint64 deadline
    ) private {
        bytes32 resourceHash = keccak256("testnet-v2-first-resource");
        bytes32 outcomeHash = keccak256("testnet-v2-first-outcome");
        bytes32 paymentId = graph.computePaymentId(taskId, mandateId, recipient, 5_000, 1, resourceHash, deadline, 1);
        graph.executePayment(mandateId, paymentId, recipient, 5_000, 1, resourceHash, deadline, 1, outcomeHash);
        graph.recordWorkProof(agentId, taskId, paymentId, outcomeHash);
    }

    function _completeSecondWork(
        MandateGraphV2 graph,
        bytes32 taskId,
        uint256 mandateId,
        address recipient,
        uint64 deadline
    ) private {
        bytes32 resourceHash = keccak256("testnet-v2-second-resource");
        bytes32 outcomeHash = keccak256("testnet-v2-second-outcome");
        bytes32 paymentId = graph.computePaymentId(taskId, mandateId, recipient, 20_000, 1, resourceHash, deadline, 2);
        graph.executePayment(mandateId, paymentId, recipient, 20_000, 1, resourceHash, deadline, 2, outcomeHash);
    }

    function _assertOverCapSimulation(
        MandateGraphV2 graph,
        address owner,
        bytes32 taskId,
        uint256 mandateId,
        address recipient,
        uint64 deadline
    ) private {
        bytes32 resourceHash = keccak256("over-cap");
        bytes32 rejectedPaymentId = graph.computePaymentId(taskId, mandateId, recipient, 26_000, 1, resourceHash, deadline, 3);
        vm.prank(owner);
        (bool success, bytes memory returnData) = address(graph).call(
            abi.encodeCall(
                graph.executePayment,
                (mandateId, rejectedPaymentId, recipient, 26_000, 1, resourceHash, deadline, 3, keccak256("rejected"))
            )
        );
        require(!success && _selector(returnData) == MandateGraphV2.AuthorityCapExceeded.selector, "over-cap simulation mismatch");
        require(!graph.usedPaymentIds(rejectedPaymentId), "simulation consumed payment ID");
    }

    function _writeEvidence(
        MandateGraphV2 graph,
        address owner,
        address recipient,
        uint256 agentId,
        bytes32 taskId,
        uint256 rootMandateId
    ) private {
        string memory identity = string.concat(
            '{"version":1,"network":"Arc Testnet","chainId":5042002,"contract":"', _address(address(graph)),
            '","owner":"', _address(owner), '","recipient":"', _address(recipient), '","agentId":"', _uint(agentId), '"'
        );
        string memory lifecycle = string.concat(
            ',"taskId":"', _hex32(taskId), '","rootMandateId":"', _uint(rootMandateId),
            '","executedPaymentBaseUnits":"25000","finalAuthorityCapBaseUnits":"25000","completedWorks":1,"violations":1'
        );
        string memory safety = ',"stopped":false,"allowanceBaseUnits":"0","overCapMode":"simulation only","overCapSelector":"0xe5bbd38c","mainnetBroadcast":false}';
        vm.writeFile(string.concat(vm.projectRoot(), "/docs/TESTNET_V2_EVIDENCE.json"), string.concat(identity, lifecycle, safety));
    }

    function _selector(bytes memory value) private pure returns (bytes4 selector) {
        if (value.length < 4) return bytes4(0);
        assembly { selector := mload(add(value, 32)) }
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

    function _address(address value) private pure returns (string memory) { return _hex(abi.encodePacked(value)); }
    function _hex32(bytes32 value) private pure returns (string memory) { return _hex(abi.encodePacked(value)); }
    function _hex(bytes memory value) private pure returns (string memory) {
        bytes16 symbols = "0123456789abcdef";
        bytes memory result = new bytes(2 + value.length * 2);
        result[0] = "0"; result[1] = "x";
        for (uint256 index; index < value.length; ++index) {
            result[2 + index * 2] = symbols[uint8(value[index] >> 4)];
            result[3 + index * 2] = symbols[uint8(value[index] & 0x0f)];
        }
        return string(result);
    }
}
