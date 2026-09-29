import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Media clips hold local blob URLs that cannot be persisted; strip before saving.
export function sanitizeConfig(config) {
  return {
    ...config,
    media: { ...config.media, clips: [], activeClipId: null },
  };
}

export const listScenes = () => axios.get(`${API}/scenes`).then((r) => r.data);
export const createScene = (name, config) =>
  axios.post(`${API}/scenes`, { name, config: sanitizeConfig(config) }).then((r) => r.data);
export const deleteScene = (id) => axios.delete(`${API}/scenes/${id}`).then((r) => r.data);
