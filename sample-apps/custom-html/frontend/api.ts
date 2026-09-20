import { createClient } from 'jsr:@timepp/dui/client'
import type { BackendAPI } from '../api-impl.ts'
export const api = createClient<BackendAPI>()
