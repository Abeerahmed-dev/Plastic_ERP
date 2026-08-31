import api from './api';

/** Health check — verifies backend and DB are reachable */
export async function getHealth() {
  const res = await api.get('/health');
  return res.data;
}
