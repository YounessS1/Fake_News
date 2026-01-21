// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FakeNewsVerifier {
    struct Information {
        bytes32 contentHash;
        string source;
        uint8 reliabilityScore; // 0..100
        bool validated;
        address author;
        uint256 timestamp;
    }

    Information[] public informations;

    address public owner;
    mapping(address => bool) public moderators;

    event InformationSubmitted(
        uint256 indexed index,
        bytes32 indexed contentHash,
        string source,
        uint8 reliabilityScore,
        address indexed author,
        uint256 timestamp
    );

    event InformationValidated(
        uint256 indexed index,
        address indexed validator,
        uint256 timestamp
    );

    event ModeratorUpdated(
        address indexed moderator,
        bool enabled,
        address indexed updatedBy,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyOwnerOrModerator() {
        require(
            msg.sender == owner || moderators[msg.sender],
            "ONLY_OWNER_OR_MODERATOR"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        moderators[msg.sender] = true; // owner est aussi modérateur
        emit ModeratorUpdated(msg.sender, true, msg.sender, block.timestamp);
    }

    function setModerator(address _moderator, bool _enabled) external onlyOwner {
        require(_moderator != address(0), "ZERO_ADDRESS");
        moderators[_moderator] = _enabled;
        emit ModeratorUpdated(_moderator, _enabled, msg.sender, block.timestamp);
    }

    function submitInformation(bytes32 _hash, string memory _source, uint8 _score) external {
        require(_hash != bytes32(0), "EMPTY_HASH");
        require(bytes(_source).length > 0, "EMPTY_SOURCE");
        require(_score <= 100, "SCORE_OUT_OF_RANGE");

        informations.push(
            Information({
                contentHash: _hash,
                source: _source,
                reliabilityScore: _score,
                validated: false,
                author: msg.sender,
                timestamp: block.timestamp
            })
        );

        uint256 idx = informations.length - 1;
        emit InformationSubmitted(idx, _hash, _source, _score, msg.sender, block.timestamp);
    }

    function validateInformation(uint256 index) external onlyOwnerOrModerator {
        require(index < informations.length, "INDEX_OOB");
        require(!informations[index].validated, "ALREADY_VALIDATED");

        informations[index].validated = true;
        emit InformationValidated(index, msg.sender, block.timestamp);
    }

    function getInformationsCount() external view returns (uint256) {
        return informations.length;
    }
}
