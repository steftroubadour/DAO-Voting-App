import React, {Component} from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import Table from 'react-bootstrap/Table';
import Alert from 'react-bootstrap/Alert';
import VotingContract from "./contracts/Voting.json";
import getWeb3 from "./getWeb3";

import "./App.css";

import {WORKFLOW} from "./constants"
import WorkflowStatus from "./components/WorkflowStatus";
import Workflow from "./components/Workflow";

class App extends Component {
    constructor(props) {
        super(props)
        this.state = {
            web3: null,
            accounts: null,
            contract: null,
            alert: null,
            isAlertShown: false,
            workflowStatus: null,
            winningProposalId: null,
            registeredVotersAddresses: null,
            isContractOwner: false,
            proposals: null,
            isRegisteredVoter: null,
            hasVoted: null,
            numberOfVotes: null,
            owner: null,
            deployedNetwork: null
        }
    }

    componentDidMount = async () => {
        try {
            // Get network provider and web3 instance.
            const web3 = await getWeb3();

            // Use web3 to get the user's accounts.
            const accounts = await web3.eth.getAccounts();

            // Get the contract instance.
            const networkId = await web3.eth.net.getId();
            const deployedNetwork = VotingContract.networks[networkId];
            const instance = new web3.eth.Contract(
                VotingContract.abi,
                deployedNetwork && deployedNetwork.address,
            );

            // Set web3, accounts, and contract to the state, and then proceed with an
            // example of interacting with the contract's methods.
            this.setState({
                web3: web3,
                accounts: accounts,
                contract: instance,
                deployedNetworkAddress: deployedNetwork.address
            }, this.initialize);
        } catch (error) {
            // Catch any errors for any of the above operations.
            alert(
                `Failed to load web3, accounts, or contract. Check console for details.`,
            );
            console.error(error);
        }
    };

    /**
     * A transaction can return an error
     * This method retrieve the error object of this transaction
     *
     * @param error
     * @returns {{reason: string}|*}
     */
    getTransactionError = function (error) {
        let message = error.message // error.message is a text

        message = message
          .substr(message.split('{')[0].length)
          .replace(/\n/g, "")

        if (message.slice(-1) === "'") {
            message = message.slice(0, -1)
        }

        error = JSON.parse(message)

        let data
        // errors don't have same structure !
        if (error.value && error.value.data && error.value.data.data) {
            data = error.value.data.data
        }

        if (!data && error.data) {
            data = error.data
        }

        if (data) {
            const txHash = Object.keys(data)[0];
            const transactionError = data[txHash]
            if (transactionError) {
                return transactionError
            }
        }

        return { reason: error }
    }

    setAlert = (variant, message) => {
        this.setState({
            alert:
                {
                    variant: variant,
                    message: message
                },
            isAlertShown: true
        })
    }

    subscribeContractEvents = () => {
        const { contract } = this.state;

        contract.events.VoterRegistered(async (error, event) => {
            if (!error) {
                await this.loadValues()
                this.setAlert("success", `New registered voter with address ${event.returnValues.voterAddress}`)

                return
            }

            console.error(error)
        })
        contract.events.WorkflowStatusChange(async (error, event) => {
            if (!error) {
                await this.loadValues()
                this.setAlert("success", `Workflow Status Change from "${WORKFLOW[event.returnValues.previousStatus].status}" to "${WORKFLOW[event.returnValues.newStatus].status}"`)

                return
            }

            console.error(error)
        })
        contract.events.ProposalRegistered(async (error, event) => {
            if (!error) {
                await this.loadValues()
                this.setAlert("success", "New registered proposal")

                return
            }

            console.error(error)
        })
        contract.events.Voted(async (error, event) => {
            if (!error) {
                await this.loadValues()
                const { proposals } = this.state
                this.setAlert("success", `Address ${event.returnValues.voter} vote for proposal "${proposals[parseInt(event.returnValues.proposalId)].description}"`)

                return
            }

            console.error(error)
        })
        contract.events.VotesTallied(async (error, event) => {
            if (!error) {
                await this.loadValues()
                this.setAlert("success", "Votes tallied")

                return
            }

            console.error(error)
        })
    }

    initialize = async () => {
        this.subscribeContractEvents()
        await this.loadValues()
    }

    loadValues = async () => {
        await this.retrieveContractOwner()
        await this.retrieveWorkflowStatus()

        const { workflowStatus, isContractOwner } = this.state;

        if (WORKFLOW[workflowStatus].status === "Registering Voters") {
            await this.retrieveRegisteredVotersAddresses()
            if (!isContractOwner) {
                this.setAlert("warning", "You are not allowed to register voters")
            }
        }

        if (WORKFLOW[workflowStatus].status === "Proposals Registration Started"
            || WORKFLOW[workflowStatus].status === "Proposals Registration Ended"
        ) {
            await this.retrieveProposals()
        }

        if (WORKFLOW[workflowStatus].status === "Voting Session Started"
            || WORKFLOW[workflowStatus].status === "Voting Session Ended"
        ) {
            await this.retrieveProposals()
            await this.countNumberOfVotes()
            await this.retrieveVoterAttributes()
        }

        if (WORKFLOW[workflowStatus].status === "Votes Tallied") {
            await this.retrieveProposals()
            await this.retrieveWinningProposalId()
            await this.countNumberOfVotes()
        }
    }

    retrieveWorkflowStatus = async () => {
        const { contract } = this.state;

        try {
            const result = await contract.methods.getWorkflowStatus().call()
            this.setState({ workflowStatus: result });
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    };

    retrieveContractOwner = async () => {
        const { contract, accounts } = this.state;

        try {
            const result = await contract.methods.owner().call()

            this.setState({
                isContractOwner: result === accounts[0],
                owner: result
            });

        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    };

    retrieveRegisteredVotersAddresses = async() => {
        const { contract, accounts } = this.state

        try {
            const registeredVotersAddresses = await contract.methods.getRegisteredVotersAddresses().call({from: accounts[0]}) // on doit spécifier l'adresse car la fonction a le modifier onlyOwner

            this.setState({ registeredVotersAddresses: registeredVotersAddresses })
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    }

    retrieveProposals = async() => {
        const { contract } = this.state

        try {
            const proposals = await contract.methods.getProposals().call()

            this.setState({ proposals: proposals })
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    };

    retrieveVoterAttributes = async() => {
        const { contract, accounts } = this.state;

        try {
            const isRegisteredVoter = await contract.methods.isRegisteredVoter(accounts[0]).call();
            this.setState({ isRegisteredVoter: isRegisteredVoter });
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }

        try {
            const hasVoted = await contract.methods.hasVoted(accounts[0]).call();

            this.setState({ hasVoted: hasVoted });
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    };

    countVotes = async() => {
        const { accounts, contract, workflowStatus, winningProposalId } = this.state;

        if (WORKFLOW[workflowStatus].status !== "Voting Session Ended") {
            this.setAlert("warning", "Impossible count")

            return
        }

        if (!winningProposalId) {
            this.setAlert("warning", "Already count")

            return
        }

        try {
            await contract.methods.countVotes().send({from: accounts[0]});
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    }

    retrieveWinningProposalId = async() => {
        const { contract } = this.state

        try {
            const winningProposalId = await contract.methods.getWinningProposalId().call()

            this.setState({ winningProposalId: winningProposalId })
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    };

    /**
     * Checks if the given string is an address
     *
     * @method isAddress
     * @param {String} address the given HEX address
     * @return {Boolean}
     */
    isAddress = (address) => {
        return (/^(0x)?[0-9a-fA-F]{40}$/i.test(address))
    }

    registerVoter = async() => {
        const { accounts, contract, registeredVotersAddresses } = this.state;
        const address = this.address.value;

        if (!this.isAddress(address)) {
            this.setAlert("warning", "Invalid address")

            return
        }

        if (registeredVotersAddresses.includes(address)) {
            this.setAlert("warning", "Voter already registered")

            return
        }

        try {
            await contract.methods.registerVoter(address).send({from: accounts[0]})
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    }

    addNewProposal = async() => {
        const { accounts, contract, proposals, workflowStatus } = this.state
        const proposal = this.proposal.value;

        if (WORKFLOW[workflowStatus].status !== "Proposals Registration Started") {
            this.setAlert("warning", "Proposals Registration is closed")

            return
        }

        if (proposals.includes(proposal)) {
            this.setAlert("warning", "Voter already registered")

            return
        }

        try {
            await contract.methods.addProposal(proposal).send({from: accounts[0]});
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    }

    vote = async() => {
        const { accounts, contract, workflowStatus, isRegisteredVoter, hasVoted } = this.state
        const proposalId = parseInt(this.proposalId.value);

        if (WORKFLOW[workflowStatus].status !== "Voting Session Started") {
            this.setAlert("warning", "Voting Session is closed")

            return
        }

        if (!isRegisteredVoter) {
            this.setAlert("warning", "You are not registered")

            return
        }

        if (hasVoted) {
            this.setAlert("warning", "Voter already vote")

            return
        }

        try {
            await contract.methods.vote(proposalId).send({from: accounts[0]});
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    }

    countNumberOfVotes = () => {
        const { proposals } = this.state

        let counter = 0
        proposals.forEach((proposal) => {
            counter += parseInt(proposal.voteCount)
        })

        this.setState({ numberOfVotes: counter })
    }

    nextWorkflowStatus = async() => {
        const { accounts, contract, workflowStatus, proposals } = this.state;

        if (!window.confirm( `Are you finished this step and go to next step : ${WORKFLOW[parseInt(workflowStatus) + 1].status} ?`)) {
            return
        }

        const method = WORKFLOW[workflowStatus].nextMethod

        if (WORKFLOW[workflowStatus].status === "Proposals Registration Started" && !proposals) {
            this.setAlert("danger", "Waiting for one proposal")

            return
        }

        try {
            await contract.methods[method]().send({from: accounts[0]})
        } catch (error) {
            this.setAlert("danger", this.getTransactionError(error).reason)
        }
    }

    getContent() {
        switch (WORKFLOW[this.state.workflowStatus].eventKey) {
            case 'registering-voters':
                if (this.state.isContractOwner) {
                    return (<>
                        <div style={{display: 'flex', justifyContent: 'center'}}>
                            <Card style={{width: '50rem'}}>
                                <Card.Header><strong>Register a new voter</strong></Card.Header>
                                <Card.Body>
                                    <Form.Group>
                                        <Form.Control type="text" id="address"
                                                      ref={(input) => {
                                                          this.address = input
                                                      }}
                                        />
                                    </Form.Group>
                                    <Button onClick={this.registerVoter} variant="dark"> Register </Button>
                                </Card.Body>
                            </Card>
                        </div>
                        <br/>
                        <div style={{display: 'flex', justifyContent: 'center'}}>
                            <Card style={{width: '50rem'}}>
                                <Card.Header><strong>Registered voters list</strong></Card.Header>
                                <Card.Body>
                                    <ListGroup variant="flush">
                                        <ListGroup.Item>
                                            <Table striped bordered hover>
                                                <thead>
                                                <tr>
                                                    <th>@</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {this.state.registeredVotersAddresses !== null &&
                                                this.state.registeredVotersAddresses.map((address, index) => <tr key={`${index}`}>
                                                    <td>{address}</td>
                                                </tr>)
                                                }
                                                </tbody>
                                            </Table>
                                        </ListGroup.Item>
                                    </ListGroup>
                                </Card.Body>
                            </Card>
                        </div>
                    </>)
                } else {
                    return ""
                }
            case 'proposals-registration':
                const proposalForm = WORKFLOW[this.state.workflowStatus].status === "Proposals Registration Started"
                    ?   (
                        <div style={{display: 'flex', justifyContent: 'center'}}>
                            <Card style={{width: '50rem'}}>
                                <Card.Header><strong>Add a new proposal</strong></Card.Header>
                                <Card.Body>
                                    <Form.Group>
                                        <Form.Control type="text" id="proposal"
                                                      ref={(input) => {
                                                          this.proposal = input
                                                      }}
                                        />
                                    </Form.Group>
                                    <Button onClick={this.addNewProposal} variant="dark"> Add </Button>
                                </Card.Body>
                            </Card>
                        </div>
                    ) : (<></>)

                return (<>
                    {proposalForm}
                    <br/>
                    <div style={{display: 'flex', justifyContent: 'center'}}>
                        <Card style={{width: '50rem'}}>
                            <Card.Header><strong>Proposals list</strong></Card.Header>
                            <Card.Body>
                                <ListGroup variant="flush">
                                    <ListGroup.Item>
                                        <Table striped bordered hover>
                                            <tbody>
                                            {this.state.proposals !== null &&
                                            this.state.proposals.map(({description}, index) => <tr key={`${index}`}>
                                                <td>{description}</td>
                                            </tr>)
                                            }
                                            </tbody>
                                        </Table>
                                    </ListGroup.Item>
                                </ListGroup>
                            </Card.Body>
                        </Card>
                    </div>
                </>)
            case 'voting-session':
                const votingForm = WORKFLOW[this.state.workflowStatus].status === "Voting Session Started"
                    ?   (<>
                        <Form.Control
                            as="select"
                            custom="true"
                            ref={(input) => {
                                this.proposalId = input
                            }}
                        >
                            <option>Choose one proposal</option>
                            {this.state.proposals !== null
                            && this.state.proposals.map(({description}, index) => <option key={`${index}`} value={`${index}`}> {description} </option>)}
                        </Form.Control>
                        <Button onClick={this.vote} variant="primary" type="submit"> Submit </Button>
                    </>) : (<></>)

                return (<>
                    <p>Number of votes : <strong>{this.state.numberOfVotes}</strong></p>
                    {votingForm}
                </>)
            case 'votes-tallied':
                return (<>
                    <h2>Proposal winner</h2>
                    <p>And the winner is <br/>
                        <strong>{this.state.proposals[this.state.winningProposalId].description}</strong><br/>
                        with <strong>{this.state.proposals[this.state.winningProposalId].voteCount}</strong> votes / {this.state.numberOfVotes} !
                    </p>
                </>)
            default:
                return ""
        }

    }

    render() {
        const {
            registeredVotersAddresses,
            workflowStatus,
            isContractOwner,
            proposals,
            winningProposalId,
            alert,
            isAlertShown
        } = this.state

        let isReadyToRender = false
        if (workflowStatus) {
            switch (WORKFLOW[workflowStatus].status) {
                case 'Registering Voters':
                    isReadyToRender = registeredVotersAddresses && true
                    break;
                case 'Proposals Registration Started':
                case 'Proposals Registration Ended':
                case 'Voting Session Started':
                case 'Voting Session Ended':
                    isReadyToRender = proposals && true
                    break;
                case 'Votes Tallied':
                    isReadyToRender = proposals && winningProposalId
                    break;
                default:
            }
        }

        if (!isReadyToRender) {
            return <p>Loading Web3, accounts, and contract...
                {/*<br />*/}
                {/*Owner is "{owner}"<br />*/}
                {/*deployed network address : {deployedNetworkAddress}<br />*/}
                {/*accounts : {Array.isArray(accounts) ? JSON.stringify(accounts) : ""}*/}
            </p>;
        }

        const nextStepButton = (
            <Button onClick={this.nextWorkflowStatus} variant="dark"> > Next workflow step > </Button>
        )

        const showAlert = isAlertShown
            ? (
                <>
                    <Alert show={isAlertShown} variant={alert.variant} onClose={() => this.setState({isAlertShown: false})} dismissible>
                        <p>
                            {alert.message}
                        </p>
                    </Alert>
                </>
            )
            : (<></>)

        return (
            <div className="App">
                <div style={{width: '50rem'}} className={"mx-auto"}>
                    <h1>Voting app</h1>
                    {showAlert}
                    <WorkflowStatus workflow_status={workflowStatus} is_contract_owner={isContractOwner}/>
                    {(isContractOwner && workflowStatus < WORKFLOW.length - 1 ) ? nextStepButton : ""}
                    <Workflow workflow_status={workflowStatus} is_contract_owner={isContractOwner}/>
                    {this.getContent()}
                </div>
            </div>
        );
    }
}

export default App