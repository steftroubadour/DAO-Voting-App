// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title voting
 * @author moa
 * @notice a notice for users
 * @dev for developers
 */
contract Voting is Ownable {
  struct Voter {
    bool isRegistered;
    bool hasVoted;
    uint votedProposalId;
  }

  struct Proposal {
    string description;
    uint voteCount;
  }

  enum WorkflowStatus {
    RegisteringVoters,
    ProposalsRegistrationStarted,
    ProposalsRegistrationEnded,
    VotingSessionStarted,
    VotingSessionEnded,
    VotesTallied
  }

  WorkflowStatus private workflowStatus;
  Proposal[] private proposals;
  uint private winningProposalId;
  address[] private registeredVotersAddresses;

  mapping(address => Voter) private voters;

  event VoterRegistered(address voterAddress);
  event ProposalsRegistrationStarted();
  event ProposalsRegistrationEnded();
  event ProposalRegistered(uint proposalId);
  event VotingSessionStarted();
  event VotingSessionEnded();
  event Voted (address voter, uint proposalId);
  event VotesTallied();
  event WorkflowStatusChange(WorkflowStatus previousStatus, WorkflowStatus newStatus);

  //modifier

  //constructor


  function nextWorkflowStatus() internal {
    WorkflowStatus oldStatus = workflowStatus;

    workflowStatus = WorkflowStatus(uint(workflowStatus) + 1);

    emit WorkflowStatusChange(oldStatus, workflowStatus);
  }

  function getWorkflowStatus() public view returns(WorkflowStatus) {
    return workflowStatus;
  }

  /**
   * @notice To register a new voter. Only owner can do this. Emit VoterRegistered event when done.
   * @dev Addresses are also stored in registeredVotersAddresses
   * @param _address is new voter address to register
   */
  function registerVoter(address _address) public onlyOwner {
    require(workflowStatus == WorkflowStatus.RegisteringVoters);
    require(!voters[_address].isRegistered);

    voters[_address].isRegistered = true;
    registeredVotersAddresses.push(_address);

    emit VoterRegistered(_address);
  }

  function isRegisteredVoter(address _address) public view returns(bool) {
    return voters[_address].isRegistered;
  }

  function getRegisteredVotersAddresses() public view onlyOwner returns(address[] memory) {
    return registeredVotersAddresses;
  }

  function startProposalRegistration() public onlyOwner {
    require(registeredVotersAddresses.length != 0, "No registered voters");
    require(workflowStatus == WorkflowStatus.RegisteringVoters);

    nextWorkflowStatus();

    emit ProposalsRegistrationStarted();
  }


  function addProposal(string memory _description) public {
    require(isRegisteredVoter(msg.sender), "Voter not registered");
    require(workflowStatus == WorkflowStatus.ProposalsRegistrationStarted, "Registration not started");

    bool isProposalExists;
    for (uint proposalId; proposalId < proposals.length; proposalId++) {
      if (keccak256(abi.encodePacked(proposals[proposalId].description)) == keccak256(abi.encodePacked(_description))) {
        isProposalExists = true;
      }
    }

    require(!isProposalExists, "Proposal already exists");

    proposals.push(Proposal({
    description: _description,
    voteCount: 0
    }));

    emit ProposalRegistered(proposals.length - 1);
  }

  function getProposals() public view returns(Proposal[] memory) {
    return proposals;
  }

  function endProposalRegistration() public onlyOwner {
    require(workflowStatus == WorkflowStatus.ProposalsRegistrationStarted, "Registration not started");
    require(proposals.length != 0, "No proposal");

    nextWorkflowStatus();

    emit ProposalsRegistrationEnded();
  }

  function startVotingSession() public onlyOwner {
    require(workflowStatus == WorkflowStatus.ProposalsRegistrationEnded, "Registration not ended");

    nextWorkflowStatus();

    emit VotingSessionStarted();
  }

  function vote(uint _proposalId) public {
    require(isRegisteredVoter(msg.sender), "Voter not registered");
    require(workflowStatus == WorkflowStatus.VotingSessionStarted, "Voting session not started");
    require(!voters[msg.sender].hasVoted, "You have already voted");

    voters[msg.sender].hasVoted = true;
    voters[msg.sender].votedProposalId = _proposalId;
    proposals[_proposalId].voteCount ++;

    emit Voted(msg.sender, _proposalId);
  }

  function hasVoted(address _address) public view returns(bool) {
    return voters[_address].hasVoted;
  }

  function endVotingSession() public onlyOwner {
    require(workflowStatus == WorkflowStatus.VotingSessionStarted, "Voting session not started");

    nextWorkflowStatus();

    emit VotingSessionEnded();
  }

  function countVotes() public onlyOwner {
    require(workflowStatus == WorkflowStatus.VotingSessionEnded, "Voting session not ended");

    uint winningVoteCount;
    for (uint proposalId; proposalId < proposals.length; proposalId++) {
      if (proposals[proposalId].voteCount > winningVoteCount) {
        winningVoteCount = proposals[proposalId].voteCount;
        winningProposalId = proposalId;
      }
    }

    nextWorkflowStatus();

    emit VotesTallied();
  }

  function getWinningProposalId() public view returns(uint) {
    require(workflowStatus == WorkflowStatus.VotesTallied, "Votes not tallied");

    return winningProposalId;
  }
}
