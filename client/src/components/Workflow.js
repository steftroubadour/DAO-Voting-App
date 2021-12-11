import {WORKFLOW} from "../constants";
import React from "react";

export default function Workflow(props) {
    const registeringVotersSpan = props.is_contract_owner ? (<>
            <span className={WORKFLOW[props.workflow_status].eventKey === 'registering-voters' ? "text-primary" : "text-secondary"}>
                Registering Voters
            </span>
            <strong> > </strong>
        </>) : ""

    return (
        <p>
            {registeringVotersSpan}
            <span className={WORKFLOW[props.workflow_status].eventKey === 'proposals-registration' ? "text-primary" : "text-secondary"}>
                Proposals Registration
            </span>
            <strong> > </strong>
            <span className={WORKFLOW[props.workflow_status].eventKey === 'voting-session' ? "text-primary" : "text-secondary"}>
                Voting Session
            </span>
            <strong> > </strong>
            <span className={WORKFLOW[props.workflow_status].eventKey === 'votes-tallied' ? "text-primary" : "text-secondary"}>
                Votes Tallied
            </span>
        </p>
    )
}