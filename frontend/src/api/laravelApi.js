import axios from "axios";

export const laravelApi = axios.create({
  baseURL:import.meta.env.VITE_LARAVEL_API_URL ||"/api",
  withCredentials: true,
});
