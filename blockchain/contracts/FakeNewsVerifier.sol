// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract FakeNewsVerifier is AccessControl {
    // Roles (Personne A)
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant ORACLE_ROLE    = keccak256("ORACLE_ROLE");

    struct Information {
        // --- Champs historiques (NE PAS CHANGER L'ORDRE) pour compatibilité frontend ---
        bytes32 contentHash;
        string source;
        uint8 reliabilityScore; // 0..100 (score initial / manuel)
        bool validated;
        address author;
        uint256 timestamp;

        // --- Nouveaux champs ajoutés (à la fin) : oracle ML + traçabilité ---
        uint8 mlScore;          // 0..100
        bool mlLabel;           // true=REAL, false=FAKE (convention)
        string modelVersion;    // ex: "v1.0"
        address oracle;         // adresse qui a écrit le score
        uint256 scoredAt;       // timestamp ML

        address validator;      // qui a validé (si validateInformation utilisé)
        uint256 validatedAt;    // timestamp validation
    }

    Information[] public informations;

    // Events existants (frontend-compatible)
    event InformationSubmitted(
        uint256 indexed index,
        address indexed author,
        bytes32 contentHash,
        string source,
        uint8 reliabilityScore,
        uint256 timestamp
    );

    event InformationValidated(
        uint256 indexed index,
        address indexed validator,
        uint256 timestamp
    );

    // Event ajouté (Oracle ML)
    event InformationScored(
        uint256 indexed index,
        uint8 score,
        bool label,
        string modelVersion,
        address indexed oracle,
        uint256 timestamp
    );

    // Constructor RBAC 
    constructor(address[] memory moderators, address[] memory oracles) {
        // admin = deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        for (uint256 i = 0; i < moderators.length; i++) {
            _grantRole(MODERATOR_ROLE, moderators[i]);
        }

        for (uint256 i = 0; i < oracles.length; i++) {
            _grantRole(ORACLE_ROLE, oracles[i]);
        }
    }

    // --- Fonctions attendues par le frontend (inchangées) ---

    function getInformationsCount() external view returns (uint256) {
        return informations.length;
    }

    function submitInformation(
        bytes32 contentHash,
        string calldata source,
        uint8 reliabilityScore
    ) external {
        require(contentHash != bytes32(0), "Invalid hash");
        require(reliabilityScore <= 100, "Score out of range");

        informations.push(
            Information({
                contentHash: contentHash,
                source: source,
                reliabilityScore: reliabilityScore,
                validated: false,
                author: msg.sender,
                timestamp: block.timestamp,

                // champs ML (init)
                mlScore: 0,
                mlLabel: false,
                modelVersion: "",
                oracle: address(0),
                scoredAt: 0,

                // traçabilité validation (init)
                validator: address(0),
                validatedAt: 0
            })
        );

        emit InformationSubmitted(
            informations.length - 1,
            msg.sender,
            contentHash,
            source,
            reliabilityScore,
            block.timestamp
        );
    }

    //  On la laisse PUBLIC (sans rôle) pour ne pas casser le frontend existant
    function validateInformation(uint256 index) external {
        require(index < informations.length, "Invalid index");

        Information storage info = informations[index];
        info.validated = true;
        info.validator = msg.sender;
        info.validatedAt = block.timestamp;

        emit InformationValidated(index, msg.sender, block.timestamp);
    }

    // --- Ajouts : Oracle ML ---

    function setMLResult(
        uint256 index,
        uint8 score,
        bool label,
        string calldata modelVersion
    ) external onlyRole(ORACLE_ROLE) {
        require(index < informations.length, "Invalid index");
        require(score <= 100, "Score out of range");

        Information storage info = informations[index];
        info.mlScore = score;
        info.mlLabel = label;
        info.modelVersion = modelVersion;
        info.oracle = msg.sender;
        info.scoredAt = block.timestamp;

        emit InformationScored(index, score, label, modelVersion, msg.sender, block.timestamp);
    }

    // --- Ajout optionnel  : validation modérateur (RBAC) ---
    function moderatorValidateInformation(uint256 index)
        external
        onlyRole(MODERATOR_ROLE)
    {
        require(index < informations.length, "Invalid index");

        Information storage info = informations[index];
        info.validated = true;
        info.validator = msg.sender;
        info.validatedAt = block.timestamp;

        emit InformationValidated(index, msg.sender, block.timestamp);
    }
}
