import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// On HTTPS deployments (Vercel) mark the auth cookies Secure; keep them
// usable over plain HTTP for local development.
const authCookieOptions = () => ({
  secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
  sameSite: 'lax' as const,
});

const setAuthCookies = (accessToken: string, refreshToken: string) => {
  Cookies.set('access_token', accessToken, { expires: 1 / 24, ...authCookieOptions() });
  Cookies.set('refresh_token', refreshToken, { expires: 7, ...authCookieOptions() });
};

class ApiClient {
  private client: AxiosInstance;
  private refreshTokenPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = Cookies.get('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshAccessToken(): Promise<string> {
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = (async () => {
      const refreshToken = Cookies.get('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token } = response.data;
      setAuthCookies(access_token, refresh_token);

      return access_token;
    })();

    try {
      return await this.refreshTokenPromise;
    } finally {
      this.refreshTokenPromise = null;
    }
  }

  private logout() {
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    Cookies.remove('user');
  }

  /**
   * Fetch a protected file through the API and hand it to the browser.
   * Downloads must go through the API because the auth cookie lives on the
   * frontend origin and is not sent to the API domain.
   */
  private async downloadFile(path: string, fileName: string) {
    const response = await this.client.get(path, { responseType: 'blob' });
    const contentType =
      (response.headers['content-type'] as string) || 'application/octet-stream';
    const blob = new Blob([response.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    const { access_token, refresh_token } = response.data;
    setAuthCookies(access_token, refresh_token);
    return response.data;
  }

  async demoLogin() {
    const response = await this.client.post('/auth/demo-login');
    const { access_token, refresh_token } = response.data;
    setAuthCookies(access_token, refresh_token);
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Dashboard
  async getDashboardMetrics(params?: Record<string, unknown>) {
    const response = await this.client.get('/dashboard/metrics', { params });
    return response.data;
  }

  // Organizations
  async getOrganizations(params?: Record<string, unknown>) {
    const response = await this.client.get('/organizations', { params });
    return response.data;
  }

  async getOrganization(id: string) {
    const response = await this.client.get(`/organizations/${id}`);
    return response.data;
  }

  // Sites
  async getSites(params?: Record<string, unknown>) {
    const response = await this.client.get('/sites', { params });
    return response.data;
  }

  async getSite(id: string) {
    const response = await this.client.get(`/sites/${id}`);
    return response.data;
  }

  async createSite(data: Record<string, unknown>) {
    const response = await this.client.post('/sites', data);
    return response.data;
  }

  async updateSite(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/sites/${id}`, data);
    return response.data;
  }

  // Users
  async getUsers(params?: Record<string, unknown>) {
    const response = await this.client.get('/users', { params });
    return response.data;
  }

  async createUser(data: Record<string, unknown>) {
    const response = await this.client.post('/users', data);
    return response.data;
  }

  async getMeProfile() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async updateUser(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/users/${id}`, data);
    return response.data;
  }

  async changePassword(data: { current_password: string; new_password: string }) {
    const response = await this.client.post('/auth/change-password', data);
    return response.data;
  }

  // Products
  async getProducts(params?: Record<string, unknown>) {
    const response = await this.client.get('/products', { params });
    return response.data;
  }

  async getProduct(id: string) {
    const response = await this.client.get(`/products/${id}`);
    return response.data;
  }

  async createProduct(data: Record<string, unknown>) {
    const response = await this.client.post('/products', data);
    return response.data;
  }

  async updateProduct(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/products/${id}`, data);
    return response.data;
  }

  // Customers
  async getCustomers(params?: Record<string, unknown>) {
    const response = await this.client.get('/customers', { params });
    return response.data;
  }

  async getCustomer(id: string) {
    const response = await this.client.get(`/customers/${id}`);
    return response.data;
  }

  async createCustomer(data: Record<string, unknown>) {
    const response = await this.client.post('/customers', data);
    return response.data;
  }

  async updateCustomer(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/customers/${id}`, data);
    return response.data;
  }

  // Suppliers
  async getSuppliers(params?: Record<string, unknown>) {
    const response = await this.client.get('/suppliers', { params });
    return response.data;
  }

  async getSupplier(id: string) {
    const response = await this.client.get(`/suppliers/${id}`);
    return response.data;
  }

  async createSupplier(data: Record<string, unknown>) {
    const response = await this.client.post('/suppliers', data);
    return response.data;
  }

  async updateSupplier(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/suppliers/${id}`, data);
    return response.data;
  }

  // Documents
  async getDocuments(params?: Record<string, unknown>) {
    const response = await this.client.get('/documents', { params });
    return response.data;
  }

  async getDocument(id: string) {
    const response = await this.client.get(`/documents/${id}`);
    return response.data;
  }

  async createDocument(data: Record<string, unknown>) {
    const response = await this.client.post('/documents', data);
    return response.data;
  }

  async updateDocument(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/documents/${id}`, data);
    return response.data;
  }

  async getDocumentVersions(id: string) {
    const response = await this.client.get(`/documents/${id}/versions`);
    return response.data;
  }

  async createDocumentVersion(id: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/documents/${id}/versions`, data);
    return response.data;
  }

  async uploadDocumentVersion(
    id: string,
    file: File,
    data: { version: string; change_summary?: string; is_current?: boolean }
  ) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('version', data.version);
    if (data.change_summary) formData.append('change_summary', data.change_summary);
    formData.append('is_current', String(data.is_current ?? true));
    const response = await this.client.post(`/documents/${id}/versions/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async downloadDocumentVersion(id: string, versionId: string, fileName: string) {
    await this.downloadFile(`/documents/${id}/versions/${versionId}/download`, fileName);
  }

  // Nonconformities
  async getNonconformities(params?: Record<string, unknown>) {
    const response = await this.client.get('/nonconformities', { params });
    return response.data;
  }

  async getNonconformityStats() {
    const response = await this.client.get('/nonconformities/stats');
    return response.data;
  }

  async getNonconformity(id: string) {
    const response = await this.client.get(`/nonconformities/${id}`);
    return response.data;
  }

  async createNonconformity(data: Record<string, unknown>) {
    const response = await this.client.post('/nonconformities', data);
    return response.data;
  }

  async updateNonconformity(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/nonconformities/${id}`, data);
    return response.data;
  }

  async submitNonconformity(id: string) {
    const response = await this.client.post(`/nonconformities/${id}/submit`);
    return response.data;
  }

  async transitionNonconformityStatus(id: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/nonconformities/${id}/status`, data);
    return response.data;
  }

  async uploadNcrAttachment(id: string, file: File, description?: string) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post(`/nonconformities/${id}/attachments`, formData, {
      params: description ? { description } : undefined,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteNcrAttachment(id: string, attachmentId: string) {
    const response = await this.client.delete(`/nonconformities/${id}/attachments/${attachmentId}`);
    return response.data;
  }

  async downloadNcrAttachment(id: string, attachmentId: string, fileName: string) {
    await this.downloadFile(`/nonconformities/${id}/attachments/${attachmentId}/download`, fileName);
  }

  // Corrective Actions
  async getCorrectiveActions(params?: Record<string, unknown>) {
    const response = await this.client.get('/corrective-actions', { params });
    return response.data;
  }

  async getCorrectiveActionStats() {
    const response = await this.client.get('/corrective-actions/stats');
    return response.data;
  }

  async getCorrectiveAction(id: string) {
    const response = await this.client.get(`/corrective-actions/${id}`);
    return response.data;
  }

  async createCorrectiveAction(data: Record<string, unknown>) {
    const response = await this.client.post('/corrective-actions', data);
    return response.data;
  }

  async updateCorrectiveAction(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/corrective-actions/${id}`, data);
    return response.data;
  }

  async startCorrectiveAction(id: string) {
    const response = await this.client.post(`/corrective-actions/${id}/start`);
    return response.data;
  }

  async completeCorrectiveAction(id: string, verificationNotes?: string) {
    const response = await this.client.post(`/corrective-actions/${id}/complete`, null, {
      params: verificationNotes ? { verification_notes: verificationNotes } : undefined,
    });
    return response.data;
  }

  async verifyCorrectiveAction(
    id: string,
    verificationNotes: string,
    effectivenessCheckDate?: string
  ) {
    const response = await this.client.post(`/corrective-actions/${id}/verify`, null, {
      params: {
        verification_notes: verificationNotes,
        ...(effectivenessCheckDate
          ? { effectiveness_check_date: effectivenessCheckDate }
          : {}),
      },
    });
    return response.data;
  }

  async createEffectivenessCheck(id: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/corrective-actions/${id}/effectiveness`, {
      ...data,
      capa_id: id,
    });
    return response.data;
  }

  // Inspections
  async getInspections(params?: Record<string, unknown>) {
    const response = await this.client.get('/inspections', { params });
    return response.data;
  }

  async getInspectionStats() {
    const response = await this.client.get('/inspections/stats');
    return response.data;
  }

  async getInspection(id: string) {
    const response = await this.client.get(`/inspections/${id}`);
    return response.data;
  }

  async createInspection(data: Record<string, unknown>) {
    const response = await this.client.post('/inspections', data);
    return response.data;
  }

  async updateInspection(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/inspections/${id}`, data);
    return response.data;
  }

  async addInspectionResult(id: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/inspections/${id}/results`, data);
    return response.data;
  }

  async deleteInspectionResult(id: string, resultId: string) {
    const response = await this.client.delete(`/inspections/${id}/results/${resultId}`);
    return response.data;
  }

  async completeInspection(id: string) {
    const response = await this.client.post(`/inspections/${id}/complete`);
    return response.data;
  }

  async getInspectionPlans(params?: Record<string, unknown>) {
    const response = await this.client.get('/inspections/plans', { params });
    return response.data;
  }

  async createInspectionPlan(data: Record<string, unknown>) {
    const response = await this.client.post('/inspections/plans', data);
    return response.data;
  }

  async updateInspectionPlan(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/inspections/plans/${id}`, data);
    return response.data;
  }

  // Complaints
  async getComplaints(params?: Record<string, unknown>) {
    const response = await this.client.get('/complaints', { params });
    return response.data;
  }

  async getComplaintStats() {
    const response = await this.client.get('/complaints/stats');
    return response.data;
  }

  async getComplaint(id: string) {
    const response = await this.client.get(`/complaints/${id}`);
    return response.data;
  }

  async createComplaint(data: Record<string, unknown>) {
    const response = await this.client.post('/complaints', data);
    return response.data;
  }

  async updateComplaint(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/complaints/${id}`, data);
    return response.data;
  }

  async createNcrFromComplaint(id: string) {
    const response = await this.client.post(`/complaints/${id}/create-ncr`);
    return response.data;
  }

  // Agent
  async getAgentRecommendations(params?: Record<string, unknown>) {
    const response = await this.client.get('/agent/recommendations', { params });
    return response.data;
  }

  async actOnRecommendation(id: string, action: string, notes?: string) {
    const response = await this.client.post(`/agent/recommendations/${id}/action`, { action, notes });
    return response.data;
  }

  async chatWithAgent(message: string, context?: Record<string, unknown>) {
    const response = await this.client.post('/agent/chat', { message, context });
    return response.data;
  }

  async triggerAgentRun(triggerType: string, triggerDetails?: Record<string, unknown>) {
    const response = await this.client.post('/agent/runs', { trigger_type: triggerType, trigger_details: triggerDetails });
    return response.data;
  }

  // Tasks
  async getTaskStats() {
    const response = await this.client.get('/tasks/stats');
    return response.data;
  }

  async getTasks(params?: Record<string, unknown>) {
    const response = await this.client.get('/tasks', { params });
    return response.data;
  }

  async getTask(id: string) {
    const response = await this.client.get(`/tasks/${id}`);
    return response.data;
  }

  async createTask(data: Record<string, unknown>) {
    const response = await this.client.post('/tasks', data);
    return response.data;
  }

  async updateTask(id: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/tasks/${id}`, data);
    return response.data;
  }

  async completeTask(id: string) {
    const response = await this.client.post(`/tasks/${id}/complete`);
    return response.data;
  }
}

export const api = new ApiClient();