// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FakeNewsVerifier {

    struct Information {
        bytes32 contentHash;
        string source;
        uint8 reliabilityScore;
        bool validated;
        address author;
        uint timestamp;
    }

    Information[] public informations;

    function submitInformation(bytes32 _hash, string memory _source, uint8 _score) public {
        informations.push(
            Information(
                _hash,
                _source,
                _score,
                false,
                msg.sender,
                block.timestamp
            )
        );
    }

    function validateInformation(uint index) public {
        informations[index].validated = true;
    }

    function getInformationsCount() public view returns (uint) {
        return informations.length;
    }
}
