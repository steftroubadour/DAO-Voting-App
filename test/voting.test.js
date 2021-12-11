// voting.test.js

const Voting = artifacts.require("./Voting.sol");
const truffleAssert = require("truffle-assertions");
const { assert} = require("chai");
const { BN } = require('@openzeppelin/test-helpers');

const WORKFLOW_STATUS = [
    "RegisteringVoters",
    "ProposalsRegistrationStarted",
    "ProposalsRegistrationEnded",
    "VotingSessionStarted",
    "VotingSessionEnded",
    "VotesTallied"
]

function getWorkflowStatusIndex(value) {
    return new BN(Object.keys(WORKFLOW_STATUS).find(key => WORKFLOW_STATUS[key] === value))
}

contract("Voting", async accounts => {
    const owner = accounts[0];
    const user = accounts[1];
    const anotherUser = accounts[2];
    let VotingInstance
    const newContractInstance = async () => {
        VotingInstance = await Voting.new()
    }

    before('SETUP', async () => {
        await newContractInstance()
    })
    describe("Initial State", () => {
        it("should registeredVotersAddresses empty", async () => {

            const registeredVotersAddresses = await VotingInstance.getRegisteredVotersAddresses({ from: owner })
            assert.isArray(registeredVotersAddresses)
        })

        it("should WorkflowStatus is zero", async () => {
            /* workflowStatus is int(256) in sol
             * workflowStatus is BN in js https://github.com/indutny/bn.js
             */
            const workflowStatus = await VotingInstance.getWorkflowStatus()
            assert.isTrue(workflowStatus.isZero())
        })
    })


    // describe("#nextWorkflowStatus()", () => {
    //     it("Only for owner", async () => {
    //         await truffleAssert.reverts(VotingInstance.nextWorkflowStatus({from: user}))
    //     })
    //
    //     const tests = new Array(6)
    //
    //     tests.forEach(({index}) => {
    //         if (index < 5) {
    //             const previousStatus = index
    //
    //             it(`Previous status : ${WORKFLOW_STATUS[previousStatus]}`, async () => {
    //                 let workflowStatus = await VotingInstance.getWorkflowStatus()
    //                 assert.strictEqual(workflowStatus, new BN(previousStatus))
    //
    //                 let result = await VotingInstance.nextWorkflowStatus({from: owner})
    //
    //                 truffleAssert.eventEmitted(result, 'WorkflowStatusChange', (event) => {
    //                     return event.previousStatus === previousStatus && event.newStatus === previousStatus + 1
    //                 });
    //
    //                 workflowStatus = await VotingInstance.getWorkflowStatus()
    //                 assert.strictEqual(workflowStatus, new BN(previousStatus + 1))
    //             });
    //         } else {
    //             it("Previous status : VotesTallied", async () => {
    //                 await truffleAssert.reverts(VotingInstance.nextWorkflowStatus({from: owner}))
    //             });
    //         }
    //     });
    // })

    describe("#registerVoter() && #isRegisteredVoter()", () => {
        it("Should be called only by owner", async () => {
            await truffleAssert.reverts(VotingInstance.registerVoter(user, {from: user}))
        })

        it("Should register voter", async () => {
            let isRegisteredVoter = await VotingInstance.isRegisteredVoter(user, {from: owner})
            assert.isFalse(isRegisteredVoter)

            let result = await VotingInstance.registerVoter(user, {from: owner})

            truffleAssert.eventEmitted(result, 'VoterRegistered', (event) => {
                return event.voterAddress === user;
            });

            isRegisteredVoter = await VotingInstance.isRegisteredVoter(user, {from: owner})
            assert.isTrue(isRegisteredVoter)

            result = await VotingInstance.getRegisteredVotersAddresses({from: owner})
            assert.isArray(result)
            assert.lengthOf(result, 1)
            assert.include(result, user)
        })
    })

    const registerNewVoter = async (user) => {
        await VotingInstance.registerVoter(user, {from: owner})
    }

    describe("#startProposalRegistration()", () => {
        describe("Without registered voters", () => {
            before('SETUP', async () => {
                await newContractInstance()
            })
            it("Should be called only by owner", async () => {
                await truffleAssert.reverts(VotingInstance.startProposalRegistration({from: user}))
            })

            it("Should voters not empty", async () => {
                await truffleAssert.reverts(VotingInstance.startProposalRegistration({from: owner}), "No registered voters")
            })
        })

        describe("With registered voters", () => {
            before('SETUP', async () => {
                await newContractInstance()
                await registerNewVoter(user)
            })
            it("Should start proposal registration", async () => {
                let workflowStatus = await VotingInstance.getWorkflowStatus()
                assert.strictEqual(workflowStatus.toNumber(), getWorkflowStatusIndex("RegisteringVoters").toNumber())

                let result = await VotingInstance.startProposalRegistration({from: owner})

                truffleAssert.eventEmitted(result, 'ProposalsRegistrationStarted');

                workflowStatus = await VotingInstance.getWorkflowStatus()
                assert.strictEqual(workflowStatus.toNumber(), getWorkflowStatusIndex("ProposalsRegistrationStarted").toNumber())
            })
        })
    })

    const startProposalRegistration = async () => {
        await VotingInstance.startProposalRegistration({from: owner})
    }

    describe("#addProposal()", () => {
        describe("Proposal registration not started", () => {
            before('SETUP', async () => {
                await newContractInstance()
                await registerNewVoter(user)
            })

            it("Should proposal registration started", async () => {
                await truffleAssert.reverts(VotingInstance.addProposal("A proposal", {from: user}), "Registration not started")
            })
        })
        describe("Proposal registration started", () => {
            before('SETUP', async () => {
                await newContractInstance()
                await registerNewVoter(user)
                await startProposalRegistration()
            })

            it("Should be called only by a registered voter", async () => {
                await truffleAssert.reverts(VotingInstance.addProposal("A proposal", {from: owner}), "Voter not registered")
            })

            it("Should register proposal", async () => {
                let proposals = await VotingInstance.getProposals()
                assert.strictEqual(proposals.length, 0)

                let result = await VotingInstance.addProposal("A proposal", {from: user})

                truffleAssert.eventEmitted(result, 'ProposalRegistered', (event) => {
                    return event.proposalId.isZero()
                });

                proposals = await VotingInstance.getProposals()
                assert.strictEqual(proposals.length, 1)
                assert.strictEqual(proposals[0].description, "A proposal")
                assert.strictEqual(proposals[0].voteCount, "0")
            })

            it("Proposal already exists", async () => {
                await truffleAssert.reverts(VotingInstance.addProposal("A proposal", {from: user}), "Proposal already exists")
            })
        })
    })

    const addProposal = async (user, description) => {
        await VotingInstance.addProposal(description, {from: user})
    }

    describe("#endProposalRegistration()", () => {
        describe("Without proposal", () => {
            before('SETUP', async () => {
                await newContractInstance()
                await registerNewVoter(user)
                await startProposalRegistration()
            })
            it("Should be called only by owner", async () => {
                await truffleAssert.reverts(VotingInstance.endProposalRegistration({from: user}))
            })

            it("Should proposals not empty", async () => {
                await truffleAssert.reverts(VotingInstance.endProposalRegistration({from: owner}), "No proposal")
            })
        })

        describe("With proposals", () => {
            before('SETUP', async () => {
                await newContractInstance()
                await registerNewVoter(user)
                await startProposalRegistration()
                await addProposal(user, "A proposal")
            })
            it("Should end proposal registration", async () => {
                let workflowStatus = await VotingInstance.getWorkflowStatus()
                assert.strictEqual(workflowStatus.toNumber(), getWorkflowStatusIndex("ProposalsRegistrationStarted").toNumber())

                let result = await VotingInstance.endProposalRegistration({from: owner})

                truffleAssert.eventEmitted(result, 'ProposalsRegistrationEnded');

                workflowStatus = await VotingInstance.getWorkflowStatus()
                assert.strictEqual(workflowStatus.toNumber(), getWorkflowStatusIndex("ProposalsRegistrationEnded").toNumber())
            })
        })
    })

    const endProposalRegistration = async () => {
        await VotingInstance.endProposalRegistration({from: owner})
    }

    describe("#startVotingSession()", () => {
        describe("Proposal registration is not ended", () => {
            before('SETUP', async () => {
                await newContractInstance()
            })
            it("Proposal registration should be ended", async () => {
                await truffleAssert.reverts(VotingInstance.startVotingSession({from: owner}), "Registration not ended")
            })
        })

        describe("Proposal registration is ended", () => {
            before('SETUP', async () => {
                await newContractInstance()
                await registerNewVoter(user)
                await startProposalRegistration()
                await addProposal(user, "A proposal")
                await endProposalRegistration()
            })
            it("Should be called only by owner", async () => {
                await truffleAssert.reverts(VotingInstance.addProposal("A proposal", {from: owner}), "Voter not registered")
            })
            it("Should start voting session", async () => {
                let workflowStatus = await VotingInstance.getWorkflowStatus()
                assert.strictEqual(workflowStatus.toNumber(), getWorkflowStatusIndex("ProposalsRegistrationEnded").toNumber())

                let result = await VotingInstance.startVotingSession({from: owner})

                truffleAssert.eventEmitted(result, 'VotingSessionStarted');

                workflowStatus = await VotingInstance.getWorkflowStatus()
                assert.strictEqual(workflowStatus.toNumber(), getWorkflowStatusIndex("VotingSessionStarted").toNumber())
            })
        })
    })

    const startVotingSession = async () => {
        await VotingInstance.startVotingSession({from: owner})
    }

    describe("#vote()", () => {
        describe("Voting session is not started", () => {
            before('SETUP', async () => {
                await newContractInstance()
                await registerNewVoter(user)
            })
            it("Voting session should be started", async () => {
                await truffleAssert.reverts(VotingInstance.vote(new BN(0), {from: user}), "Voting session not started")
            })
        })

        describe("Voting session is started", () => {
            before('SETUP', async () => {
                await newContractInstance()
                await registerNewVoter(user)
                await startProposalRegistration()
                await addProposal(user, "A proposal")
                await endProposalRegistration()
                await startVotingSession()
            })
            it("Should be called by a registered voter", async () => {
                await truffleAssert.reverts(VotingInstance.vote(new BN(0), {from: owner}), "Voter not registered")
            })
            it("Should vote", async () => {
                let hasVoted = await VotingInstance.hasVoted(user, {from: user})
                assert.isFalse(hasVoted)

                let result = await VotingInstance.vote(new BN(0), {from: user})

                truffleAssert.eventEmitted(result, 'Voted', (event) => {
                    return event.voter === user && event.proposalId.isZero()
                });

                hasVoted = await VotingInstance.hasVoted(user, {from: user})
                assert.isTrue(hasVoted)
            })
            it("Should user already vote", async () => {
                await truffleAssert.reverts(VotingInstance.vote(new BN(0), {from: user}), "You have already voted")
            })
        })
    })

    const vote = async (user, proposalId) => {
        await VotingInstance.vote(proposalId, {from: user})
    }

    // to do : test endVotingSession()

    const endVotingSession = async () => {
        await VotingInstance.endVotingSession({from: owner})
    }

    describe("#countVotes()", () => {
        describe("Voting session is not ended", () => {
            before('SETUP', async () => {
                await newContractInstance()
                await registerNewVoter(user)
            })
            it("Voting session should be end", async () => {
                await truffleAssert.reverts(VotingInstance.countVotes({from: owner}), "Voting session not ended")
            })
        })

        describe("Voting session is ended", () => {
            before('SETUP', async () => {
                await newContractInstance()
                await registerNewVoter(user)
                await startProposalRegistration()
                await addProposal(user, "A proposal")
                await endProposalRegistration()
                await startVotingSession()
                await vote(user, new BN(0))
                await endVotingSession()
            })
            it("Should be called by owner", async () => {
                await truffleAssert.reverts(VotingInstance.countVotes({from: user}))
            })
            it("Should count votes", async () => {
                let workflowStatus = await VotingInstance.getWorkflowStatus()
                assert.strictEqual(workflowStatus.toNumber(), getWorkflowStatusIndex("VotingSessionEnded").toNumber())

                const result = await VotingInstance.countVotes({from: owner})

                truffleAssert.eventEmitted(result, 'VotesTallied');

                workflowStatus = await VotingInstance.getWorkflowStatus()
                assert.strictEqual(workflowStatus.toNumber(), getWorkflowStatusIndex("VotesTallied").toNumber())
            })
            it("Should retrieve winningProposalId", async () => {
                const result = await VotingInstance.getWinningProposalId({from: user})
                assert.isTrue(result.isZero())
            })
        })
    })
})
