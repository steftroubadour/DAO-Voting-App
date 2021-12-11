export const WORKFLOW = [
    {status: "Registering Voters", eventKey: "registering-voters", isOnlyForOwner: true, nextMethod: "startProposalRegistration"},
    {status: "Proposals Registration Started", eventKey: "proposals-registration", isOnlyForOwner: false, nextMethod: "endProposalRegistration"},
    {status: "Proposals Registration Ended", eventKey: "proposals-registration", isOnlyForOwner: null, nextMethod: "startVotingSession"},
    {status: "Voting Session Started", eventKey: "voting-session", isOnlyForOwner: false, nextMethod: "endVotingSession"},
    {status: "Voting Session Ended", eventKey: "voting-session", isOnlyForOwner: null, nextMethod: "countVotes"},
    {status: "Votes Tallied", eventKey: "votes-tallied", isOnlyForOwner: false, nextMethod: null},
]