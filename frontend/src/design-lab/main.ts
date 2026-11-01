import "../app.css";
import { mount } from "svelte";
import DesignLab from "./DesignLab.svelte";

mount(DesignLab, { target: document.getElementById("app")! });
