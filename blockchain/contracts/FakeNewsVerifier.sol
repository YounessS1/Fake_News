// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FakeNewsVerifier {
    address public owner;
    mapping(address => bool) public moderators;

    struct Information {
        bytes32 contentHash;
        string source;
        uint8 reliabilityScore;
        bool validated;
        address author;
        uint timestamp;
    }

    Information[] public informations;

    event InformationSubmitted(uint indexed index, bytes32 contentHash, string source, uint8 score, address indexed author);
    event InformationValidated(uint indexed index, address indexed validator);
    event ModeratorUpdated(address indexed moderator, bool enabled);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyModerator() {
        require(moderators[msg.sender] || msg.sender == owner, "Only moderator/owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        moderators[msg.sender] = true; // le deployer est modérateur
    }

    function setModerator(address _mod, bool _enabled) external onlyOwner {
        moderators[_mod] = _enabled;
        emit ModeratorUpdated(_mod, _enabled);
    }

    function submitInformation(bytes32 _hash, string memory _source, uint8 _score) public {
        require(_score <= 100, "Score must be 0-100");

        informations.push(
            Information(_hash, _source, _score, false, msg.sender, block.timestamp)
        );

        emit InformationSubmitted(informations.length - 1, _hash, _source, _score, msg.sender);
    }

    function validateInformation(uint index) public onlyModerator {
        require(index < informations.length, "Index out of bounds");
        informations[index].validated = true;
        emit InformationValidated(index, msg.sender);
    }

    function getInformationsCount() public view returns (uint) {
        return informations.length;
    }
}
