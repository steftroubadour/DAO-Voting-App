import {WORKFLOW} from "../constants";
import React from "react";

export default function WorkflowStatus(props) {
    if (props.is_contract_owner) {
        return (
            <p className={"bg-info"}>
                Workflow status : {WORKFLOW[props.workflow_status].status}
            </p>
        )
    } else {
        return ""
    }
}