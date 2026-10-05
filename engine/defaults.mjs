import {createHandoffPlan} from './handoff.mjs';
// Retain factory exports while ensuring every new workspace uses neutral inputs.
export function createCurrentPlan(){return createHandoffPlan();}
export const CURRENT_PLAN=createCurrentPlan();
