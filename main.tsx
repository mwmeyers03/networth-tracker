import {createRoot} from "react-dom/client";
import Planner from "./features/planner/Planner";
import "./app/globals.css";
createRoot(document.getElementById("root")!).render(<Planner/>);
