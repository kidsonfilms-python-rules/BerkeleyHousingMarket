// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ClaimVerifier.sol";

contract OuttaTheUnits {
    uint256 public constant MIN_ARBITRATOR_STAKE = 0.01 ether;
    uint256 public constant CHALLENGE_BOND = 0.001 ether;
    // Short windows are intentional for the public-testnet demo deployment.
    uint256 public constant DISPUTE_COMMIT_WINDOW = 5 minutes;
    uint256 public constant DISPUTE_REVEAL_WINDOW = 5 minutes;
    uint256 public constant ARBITRATOR_PANEL_SIZE = 5;
    uint256 public constant NON_REVEAL_SLASH_BPS = 2000;
    uint256 public constant MINORITY_SLASH_BPS = 1000;

    enum ReportState {
        Listed,
        Purchased,
        Delivered,
        Settled,
        Disputed,
        Invalid,
        Refunded
    }

    struct Report {
        address payable seller;
        address payable buyer;
        uint256 price;
        uint256 truthBond;
        uint256 deliveryBond;
        uint256 deliveryDeadline;
        uint256 challengePeriod;
        uint256 challengeEndsAt;
        bytes32 reportCommitment;
        bytes32 ciphertextHash;
        bytes32 keyCommitment;
        ReportState state;
        bool truthBondClaimed;
        bool zkClaimVerified;
        uint256 claimedAmount;
    }

    struct Dispute {
        uint256 reportId;
        uint256 commitDeadline;
        uint256 revealDeadline;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 rewardPool;
        bool resolved;
    }

    uint256 public nextReportId;
    uint256 public nextDisputeId;
    mapping(uint256 => Report) public reports;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(address => bytes32)) public voteCommitments;
    mapping(uint256 => mapping(address => bool)) public voteRevealed;
    mapping(uint256 => mapping(address => bool)) public voteVerdict;
    mapping(uint256 => mapping(address => uint256)) public arbitratorRewards;
    mapping(address => uint256) public arbitratorStake;
    mapping(address => uint256) public arbitratorLockedStake;
    mapping(address => uint256) public arbitratorWins;
    mapping(address => uint256) public arbitratorLosses;
    mapping(address => string) private arbitratorEncryptionKeys;
    mapping(address => uint256) public sellerResolvedReports;
    mapping(address => uint256) public sellerInvalidReports;
    Groth16Verifier public immutable claimVerifier;
    mapping(uint256 => address[]) private disputePanel;
    mapping(uint256 => string) private publicPropertyAddress;
    mapping(uint256 => string) private publicReportType;
    mapping(uint256 => mapping(address => bool)) public panelMember;
    mapping(uint256 => mapping(address => bool)) public panelLocked;
    address[] private arbitrators;
    mapping(uint256 => bytes32) public reportProperty;
    mapping(bytes32 => uint256) public propertyReportCount;
    mapping(bytes32 => uint256) public propertyCorroborationCount;
    mapping(uint256 => mapping(address => bool)) public corroborated;

    event ReportListed(uint256 indexed reportId, address indexed seller, uint256 price, bytes32 reportCommitment);
    event ReportPurchased(uint256 indexed reportId, address indexed buyer);
    event DeliveryPrecommitted(uint256 indexed reportId, bytes32 ciphertextHash, bytes32 keyCommitment);
    event ReportDelivered(uint256 indexed reportId, bytes32 ciphertextHash, bytes32 keyCommitment);
    event PaymentReleased(uint256 indexed reportId, address indexed seller);
    event RefundClaimed(uint256 indexed reportId, address indexed buyer);
    event TruthBondClaimed(uint256 indexed reportId, address indexed seller);
    event ArbitratorRegistered(address indexed arbitrator, uint256 amount);
    event DisputeOpened(uint256 indexed disputeId, uint256 indexed reportId, address indexed buyer);
    event VoteCommitted(uint256 indexed disputeId, address indexed arbitrator);
    event VoteRevealed(uint256 indexed disputeId, address indexed arbitrator, bool sellerValid);
    event DisputeResolved(uint256 indexed disputeId, uint256 indexed reportId, bool sellerValid);
    event ClaimProofVerified(uint256 indexed reportId, uint256 claimedAmount);
    event ArbitratorStakeWithdrawn(address indexed arbitrator, uint256 amount);
    event ReportPropertyAssociated(uint256 indexed reportId, bytes32 indexed propertyId);
    event ReportCorroborated(uint256 indexed reportId, bytes32 indexed propertyId, address indexed corroborator);

    constructor() {
        claimVerifier = new Groth16Verifier();
    }

    modifier reportExists(uint256 reportId) {
        require(reportId < nextReportId, "report does not exist");
        _;
    }

    function registerArbitrator() external payable {
        require(msg.value >= MIN_ARBITRATOR_STAKE, "stake too small");
        if (arbitratorStake[msg.sender] == 0) arbitrators.push(msg.sender);
        arbitratorStake[msg.sender] += msg.value;
        emit ArbitratorRegistered(msg.sender, msg.value);
    }

    /// @notice Registers the arbitrator's X25519 public key for private panel evidence.
    function setArbitratorEncryptionKey(string calldata publicKey) external {
        require(arbitratorStake[msg.sender] >= MIN_ARBITRATOR_STAKE, "register arbitrator first");
        require(bytes(publicKey).length > 0 && bytes(publicKey).length <= 256, "invalid public key");
        arbitratorEncryptionKeys[msg.sender] = publicKey;
    }

    function arbitratorEncryptionKey(address arbitrator) external view returns (string memory) {
        return arbitratorEncryptionKeys[arbitrator];
    }

    function withdrawArbitratorStake(uint256 amount) external {
        require(amount > 0 && amount <= arbitratorStake[msg.sender] - arbitratorLockedStake[msg.sender], "stake locked or invalid");
        arbitratorStake[msg.sender] -= amount;
        _send(payable(msg.sender), amount);
        emit ArbitratorStakeWithdrawn(msg.sender, amount);
    }

    function getDisputePanel(uint256 disputeId) external view returns (address[] memory) {
        return disputePanel[disputeId];
    }

    function createReport(
        bytes32 reportCommitment,
        uint256 price,
        uint256 deliveryDeadline,
        uint256 challengePeriod,
        uint256 truthBond,
        uint256 deliveryBond
    ) external payable returns (uint256 reportId) {
        require(reportCommitment != bytes32(0), "missing commitment");
        require(price > 0, "price is zero");
        require(deliveryDeadline > block.timestamp, "deadline is past");
        require(challengePeriod > 0, "challenge period is zero");
        require(truthBond > 0 && deliveryBond > 0, "bonds are required");
        require(msg.value == truthBond + deliveryBond, "incorrect bond value");

        reportId = nextReportId++;
        reports[reportId] = Report({
            seller: payable(msg.sender),
            buyer: payable(address(0)),
            price: price,
            truthBond: truthBond,
            deliveryBond: deliveryBond,
            deliveryDeadline: deliveryDeadline,
            challengePeriod: challengePeriod,
            challengeEndsAt: 0,
            reportCommitment: reportCommitment,
            ciphertextHash: bytes32(0),
            keyCommitment: bytes32(0),
            state: ReportState.Listed,
            truthBondClaimed: false,
            zkClaimVerified: false,
            claimedAmount: 0
        });

        emit ReportListed(reportId, msg.sender, price, reportCommitment);
    }

    /// @notice Atomically creates a publicly discoverable, delivery-precommitted listing.
    function createReportWithMetadata(
        bytes32 reportCommitment,
        uint256 price,
        uint256 deliveryDeadline,
        uint256 challengePeriod,
        uint256 truthBond,
        uint256 deliveryBond,
        string calldata propertyAddress,
        string calldata intelligenceType,
        bytes32 ciphertextHash,
        bytes32 keyCommitment
    ) external payable returns (uint256 reportId) {
        require(reportCommitment != bytes32(0), "missing commitment");
        require(price > 0 && deliveryDeadline > block.timestamp && challengePeriod > 0, "invalid listing");
        require(truthBond > 0 && deliveryBond > 0 && msg.value == truthBond + deliveryBond, "invalid bonds");
        require(bytes(propertyAddress).length > 0 && bytes(intelligenceType).length > 0, "metadata required");
        require(ciphertextHash != bytes32(0) && keyCommitment != bytes32(0), "missing delivery commitments");
        reportId = nextReportId++;
        reports[reportId] = Report(payable(msg.sender), payable(address(0)), price, truthBond, deliveryBond, deliveryDeadline, challengePeriod, 0, reportCommitment, ciphertextHash, keyCommitment, ReportState.Listed, false, false, 0);
        bytes32 propertyId = keccak256(bytes(propertyAddress));
        reportProperty[reportId] = propertyId;
        propertyReportCount[propertyId]++;
        publicPropertyAddress[reportId] = propertyAddress;
        publicReportType[reportId] = intelligenceType;
        emit ReportListed(reportId, msg.sender, price, reportCommitment);
        emit ReportPropertyAssociated(reportId, propertyId);
        emit DeliveryPrecommitted(reportId, ciphertextHash, keyCommitment);
    }

    function purchaseReport(uint256 reportId) external payable reportExists(reportId) {
        Report storage report = reports[reportId];
        require(report.state == ReportState.Listed, "report unavailable");
        require(msg.value == report.price, "incorrect payment");
        require(msg.sender != report.seller, "seller cannot buy own report");

        report.buyer = payable(msg.sender);
        if (report.ciphertextHash != bytes32(0) && report.keyCommitment != bytes32(0)) {
            report.challengeEndsAt = block.timestamp + report.challengePeriod;
            report.state = ReportState.Delivered;
            emit ReportDelivered(reportId, report.ciphertextHash, report.keyCommitment);
        } else {
            report.state = ReportState.Purchased;
        }
        emit ReportPurchased(reportId, msg.sender);
    }

    function precommitDelivery(uint256 reportId, bytes32 ciphertextHash, bytes32 keyCommitment) external reportExists(reportId) {
        Report storage report = reports[reportId];
        require(msg.sender == report.seller, "only seller");
        require(report.state == ReportState.Listed, "report unavailable");
        require(ciphertextHash != bytes32(0) && keyCommitment != bytes32(0), "missing delivery commitments");
        report.ciphertextHash = ciphertextHash;
        report.keyCommitment = keyCommitment;
        emit DeliveryPrecommitted(reportId, ciphertextHash, keyCommitment);
    }

    function associateReportProperty(uint256 reportId, bytes32 propertyId) external reportExists(reportId) {
        Report storage report = reports[reportId];
        require(msg.sender == report.seller, "only seller");
        require(propertyId != bytes32(0) && reportProperty[reportId] == bytes32(0), "property already associated");
        reportProperty[reportId] = propertyId;
        propertyReportCount[propertyId]++;
        emit ReportPropertyAssociated(reportId, propertyId);
    }

    /// @notice Public discovery metadata. Private report contents and evidence remain off-chain.
    function setReportMetadata(uint256 reportId, string calldata propertyAddress, string calldata intelligenceType) external reportExists(reportId) {
        Report storage report = reports[reportId];
        require(msg.sender == report.seller, "only seller");
        require(bytes(propertyAddress).length > 0 && bytes(intelligenceType).length > 0, "metadata required");
        require(reportProperty[reportId] == keccak256(bytes(propertyAddress)), "property mismatch");
        require(bytes(publicPropertyAddress[reportId]).length == 0, "metadata already set");
        publicPropertyAddress[reportId] = propertyAddress;
        publicReportType[reportId] = intelligenceType;
    }

    function reportMetadata(uint256 reportId) external view reportExists(reportId) returns (string memory propertyAddress, string memory intelligenceType) {
        return (publicPropertyAddress[reportId], publicReportType[reportId]);
    }

    function corroborateReport(uint256 reportId) external reportExists(reportId) {
        bytes32 propertyId = reportProperty[reportId];
        require(propertyId != bytes32(0), "property not associated");
        require(!corroborated[reportId][msg.sender], "already corroborated");
        require(msg.sender != reports[reportId].seller, "seller cannot corroborate");
        corroborated[reportId][msg.sender] = true;
        propertyCorroborationCount[propertyId]++;
        emit ReportCorroborated(reportId, propertyId, msg.sender);
    }

    function verifyClaim(
        uint256 reportId,
        uint[2] calldata proofA,
        uint[2][2] calldata proofB,
        uint[2] calldata proofC,
        uint[2] calldata publicSignals
    ) external reportExists(reportId) {
        Report storage report = reports[reportId];
        require(msg.sender == report.seller, "only seller");
        require(bytes32(publicSignals[1]) == report.reportCommitment, "commitment mismatch");
        require(claimVerifier.verifyProof(proofA, proofB, proofC, publicSignals), "invalid zk proof");
        report.zkClaimVerified = true;
        report.claimedAmount = publicSignals[0];
        emit ClaimProofVerified(reportId, publicSignals[0]);
    }

    function deliverReport(
        uint256 reportId,
        bytes32 ciphertextHash,
        bytes32 keyCommitment
    ) external reportExists(reportId) {
        Report storage report = reports[reportId];
        require(msg.sender == report.seller, "only seller");
        require(report.state == ReportState.Purchased, "not purchased");
        require(block.timestamp <= report.deliveryDeadline, "delivery deadline passed");
        require(ciphertextHash != bytes32(0) && keyCommitment != bytes32(0), "missing delivery commitments");

        report.ciphertextHash = ciphertextHash;
        report.keyCommitment = keyCommitment;
        report.challengeEndsAt = block.timestamp + report.challengePeriod;
        report.state = ReportState.Delivered;
        emit ReportDelivered(reportId, ciphertextHash, keyCommitment);
    }

    function confirmDelivery(
        uint256 reportId,
        bytes32 deliveredCiphertextHash,
        string calldata revealedKey
    ) external reportExists(reportId) {
        Report storage report = reports[reportId];
        require(msg.sender == report.buyer, "only buyer");
        require(report.state == ReportState.Delivered, "not delivered");
        require(deliveredCiphertextHash == report.ciphertextHash, "ciphertext mismatch");
        require(keccak256(bytes(revealedKey)) == report.keyCommitment, "key mismatch");

        report.state = ReportState.Settled;
        _send(report.seller, report.price + report.deliveryBond);
        emit PaymentReleased(reportId, report.seller);
    }

    function claimRefund(uint256 reportId) external reportExists(reportId) {
        Report storage report = reports[reportId];
        require(msg.sender == report.buyer, "only buyer");
        require(report.state == ReportState.Purchased, "refund unavailable");
        require(block.timestamp > report.deliveryDeadline, "delivery window open");

        report.state = ReportState.Refunded;
        _send(report.buyer, report.price);
        _send(report.seller, report.truthBond);
        emit RefundClaimed(reportId, report.buyer);
    }

    function claimTruthBond(uint256 reportId) external reportExists(reportId) {
        Report storage report = reports[reportId];
        require(msg.sender == report.seller, "only seller");
        require(report.state == ReportState.Settled, "report not settled");
        require(block.timestamp > report.challengeEndsAt, "challenge period open");
        require(!report.truthBondClaimed, "truth bond claimed");

        report.truthBondClaimed = true;
        _send(report.seller, report.truthBond);
        emit TruthBondClaimed(reportId, report.seller);
    }

    function openDispute(uint256 reportId) external payable reportExists(reportId) returns (uint256 disputeId) {
        Report storage report = reports[reportId];
        require(msg.sender == report.buyer, "only buyer");
        require(report.state == ReportState.Delivered, "not challengeable");
        require(block.timestamp <= report.challengeEndsAt, "challenge period ended");
        require(msg.value == CHALLENGE_BOND, "incorrect challenge bond");
        require(arbitrators.length >= ARBITRATOR_PANEL_SIZE, "not enough arbitrators");

        disputeId = nextDisputeId++;
        disputes[disputeId] = Dispute({
            reportId: reportId,
            commitDeadline: block.timestamp + DISPUTE_COMMIT_WINDOW,
            revealDeadline: block.timestamp + DISPUTE_COMMIT_WINDOW + DISPUTE_REVEAL_WINDOW,
            yesVotes: 0,
            noVotes: 0,
            rewardPool: 0,
            resolved: false
        });
        uint256 start = uint256(keccak256(abi.encode(block.prevrandao, block.timestamp, reportId))) % arbitrators.length;
        for (uint256 offset = 0; offset < ARBITRATOR_PANEL_SIZE; offset++) {
            address member = arbitrators[(start + offset) % arbitrators.length];
            disputePanel[disputeId].push(member);
            panelMember[disputeId][member] = true;
            panelLocked[disputeId][member] = true;
            arbitratorLockedStake[member] += MIN_ARBITRATOR_STAKE;
        }
        report.state = ReportState.Disputed;
        emit DisputeOpened(disputeId, reportId, msg.sender);
    }

    function commitVote(uint256 disputeId, bytes32 commitment) external {
        Dispute storage dispute = disputes[disputeId];
        require(block.timestamp <= dispute.commitDeadline, "commit window closed");
        require(panelMember[disputeId][msg.sender], "not selected for dispute");
        require(voteCommitments[disputeId][msg.sender] == bytes32(0), "vote already committed");
        require(commitment != bytes32(0), "missing commitment");

        voteCommitments[disputeId][msg.sender] = commitment;
        emit VoteCommitted(disputeId, msg.sender);
    }

    function revealVote(uint256 disputeId, bool sellerValid, bytes32 salt) external {
        Dispute storage dispute = disputes[disputeId];
        require(block.timestamp > dispute.commitDeadline, "commit window open");
        require(block.timestamp <= dispute.revealDeadline, "reveal window closed");
        require(voteCommitments[disputeId][msg.sender] != bytes32(0), "vote not committed");
        require(!voteRevealed[disputeId][msg.sender], "vote already revealed");
        require(
            voteCommitments[disputeId][msg.sender] == keccak256(abi.encode(sellerValid, salt)),
            "invalid reveal"
        );

        voteRevealed[disputeId][msg.sender] = true;
        voteVerdict[disputeId][msg.sender] = sellerValid;
        if (sellerValid) {
            dispute.yesVotes++;
        } else {
            dispute.noVotes++;
        }
        emit VoteRevealed(disputeId, msg.sender, sellerValid);
    }

    function resolveDispute(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        require(!dispute.resolved, "already resolved");
        require(block.timestamp > dispute.revealDeadline, "reveal window open");
        require(dispute.yesVotes + dispute.noVotes == ARBITRATOR_PANEL_SIZE, "panel votes incomplete");

        dispute.resolved = true;
        Report storage report = reports[dispute.reportId];
        bool sellerValid = dispute.yesVotes >= dispute.noVotes;

        if (sellerValid) {
            report.state = ReportState.Settled;
            report.truthBondClaimed = true;
            _send(report.seller, report.price + report.truthBond + report.deliveryBond);
            _send(report.seller, CHALLENGE_BOND);
            sellerResolvedReports[report.seller]++;
        } else {
            report.state = ReportState.Invalid;
            uint256 buyerAward = (report.truthBond * 80) / 100;
            dispute.rewardPool = report.truthBond - buyerAward;
            _send(report.buyer, report.price + buyerAward + CHALLENGE_BOND);
            _send(report.seller, report.deliveryBond);
            sellerInvalidReports[report.seller]++;
        }

        _unlockAndScorePanel(disputeId, sellerValid);

        emit DisputeResolved(disputeId, dispute.reportId, sellerValid);
    }

    function resolveUnrevealedDispute(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        require(!dispute.resolved, "already resolved");
        require(block.timestamp > dispute.revealDeadline, "reveal window open");
        require(dispute.yesVotes + dispute.noVotes < ARBITRATOR_PANEL_SIZE, "all votes revealed");

        dispute.resolved = true;
        Report storage report = reports[dispute.reportId];
        report.state = ReportState.Invalid;
        uint256 buyerAward = (report.truthBond * 80) / 100;
        dispute.rewardPool = report.truthBond - buyerAward;
        _send(report.buyer, report.price + buyerAward + CHALLENGE_BOND);
        _send(report.seller, report.deliveryBond);
        sellerInvalidReports[report.seller]++;
        _unlockAndScorePanel(disputeId, false);
        emit DisputeResolved(disputeId, dispute.reportId, false);
    }

    function claimArbitratorReward(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.resolved, "dispute unresolved");
        require(voteRevealed[disputeId][msg.sender], "no revealed vote");
        require(arbitratorRewards[disputeId][msg.sender] == 0, "reward claimed");

        bool sellerValid = dispute.yesVotes >= dispute.noVotes;
        require(voteVerdict[disputeId][msg.sender] == sellerValid, "minority vote");
        uint256 winningVotes = sellerValid ? dispute.yesVotes : dispute.noVotes;
        uint256 reward = dispute.rewardPool / winningVotes;
        arbitratorRewards[disputeId][msg.sender] = reward;
        _send(payable(msg.sender), reward);
    }

    function _unlockAndScorePanel(uint256 disputeId, bool sellerValid) internal {
        address[] storage panel = disputePanel[disputeId];
        Dispute storage dispute = disputes[disputeId];
        for (uint256 index = 0; index < panel.length; index++) {
            address member = panel[index];
            if (!panelLocked[disputeId][member]) continue;
            panelLocked[disputeId][member] = false;
            arbitratorLockedStake[member] -= MIN_ARBITRATOR_STAKE;
            if (voteRevealed[disputeId][member]) {
                if (voteVerdict[disputeId][member] == sellerValid) arbitratorWins[member]++;
                else arbitratorLosses[member]++;
            } else {
                uint256 slash = (MIN_ARBITRATOR_STAKE * NON_REVEAL_SLASH_BPS) / 10000;
                arbitratorStake[member] -= slash;
                dispute.rewardPool += slash;
                arbitratorLosses[member]++;
            }
        }
    }

    function _send(address payable recipient, uint256 amount) internal {
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "transfer failed");
    }
}
