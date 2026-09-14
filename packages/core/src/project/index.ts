/** Subsistema de proyectos de @nodedesk/core. */
export { ProjectManager } from "./project-manager.js";
export { NodeProject } from "./node-project.js";
export { readPackageJson, hasPackageJson } from "./package-json.js";
export {
  detectPackageManager,
  scriptCommand,
  installCommand,
  supportedPackageManagers
} from "./package-manager.js";
