import { apiImpl } from "./api_impl.ts";
import { startDenoWebApp } from "../dwa/dwa_service.ts";

startDenoWebApp('./frontend', 8080, apiImpl);
console.log(`HTTP server running. Access it at: http://localhost:8080/`);
