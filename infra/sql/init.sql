-- QualityAgent Database Initialization
-- This runs on first container startup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pgvector for semantic search (will be used in Phase 3)
-- CREATE EXTENSION IF NOT EXISTS vector;  -- Requires pgvector installation

-- Create custom types
CREATE TYPE organization_status AS ENUM ('active', 'inactive', 'trial');
CREATE TYPE user_role AS ENUM ('admin', 'quality_manager', 'quality_inspector', 'production_worker', 'viewer');
CREATE TYPE ncr_status AS ENUM ('draft', 'open', 'contained', 'investigating', 'action_pending', 'effectiveness_review', 'closed', 'reopened');
CREATE TYPE ncr_severity AS ENUM ('critical', 'major', 'minor', 'observation');
CREATE TYPE capa_status AS ENUM ('draft', 'assigned', 'in_progress', 'pending_review', 'effectiveness_check', 'completed', 'rejected');
CREATE TYPE document_status AS ENUM ('draft', 'under_review', 'approved', 'published', 'archived', 'obsolete');

-- Organizations (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'Asia/Jerusalem',
    status organization_status DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites/Plants within an organization
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    address TEXT,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    identity_id VARCHAR(255) NOT NULL, -- Keycloak/Auth0 subject ID
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'viewer',
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, identity_id),
    UNIQUE(tenant_id, email)
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    revision VARCHAR(50) DEFAULT '1.0',
    unit VARCHAR(20),
    category VARCHAR(100),
    drawing_number VARCHAR(100),
    specification JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, sku)
);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    quality_requirements TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    quality_rating DECIMAL(3,2),
    is_approved BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    status document_status DEFAULT 'draft',
    current_version_id UUID,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    effective_from DATE,
    effective_until DATE,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- Document Versions
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    checksum VARCHAR(64),
    change_summary TEXT,
    uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, version)
);

-- Nonconformities (NCR)
CREATE TABLE nonconformities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    number VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity ncr_severity NOT NULL DEFAULT 'minor',
    status ncr_status NOT NULL DEFAULT 'draft',
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    lot_number VARCHAR(100),
    serial_number VARCHAR(100),
    defect_code VARCHAR(50),
    defect_description TEXT,
    measured_value DECIMAL(15,5),
    unit VARCHAR(20),
    requirement_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
    detected_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
    contained_at TIMESTAMPTZ,
    contained_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    containment_action TEXT,
    root_cause TEXT,
    root_cause_analysis_method VARCHAR(100),
    closed_at TIMESTAMPTZ,
    closed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    closure_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, number)
);

-- NCR Attachments (Photos, files)
CREATE TABLE ncr_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ncr_id UUID NOT NULL REFERENCES nonconformities(id) ON DELETE CASCADE,
    file_key VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    description TEXT,
    uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stored file blobs (uploads survive redeploys on hosts without a disk)
CREATE TABLE IF NOT EXISTS file_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(150),
    size_bytes BIGINT NOT NULL,
    checksum VARCHAR(64),
    content BYTEA NOT NULL,
    uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_file_object_tenant_key UNIQUE (tenant_id, key)
);

-- Corrective Actions (CAPA)
CREATE TABLE corrective_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ncr_id UUID NOT NULL REFERENCES nonconformities(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'correction', 'corrective_action', 'preventive_action'
    status capa_status NOT NULL DEFAULT 'draft',
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    verified_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,
    effectiveness_check_date DATE,
    effectiveness_result BOOLEAN,
    effectiveness_evidence TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Effectiveness Checks
CREATE TABLE effectiveness_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    capa_id UUID NOT NULL REFERENCES corrective_actions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    check_date DATE NOT NULL,
    result BOOLEAN NOT NULL,
    evidence TEXT,
    checked_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Runs (for AI agent tracking)
CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    trigger_type VARCHAR(50) NOT NULL, -- 'scheduled', 'manual', 'event'
    trigger_details JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    result_summary JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Recommendations
CREATE TABLE agent_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'repeated_defect', 'overdue_capa', 'document_expiry', 'trend_alert', 'rca_suggestion'
    severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    rationale TEXT,
    confidence VARCHAR(20), -- 'low', 'medium', 'high'
    evidence JSONB DEFAULT '[]',
    missing_information JSONB DEFAULT '[]',
    recommended_action JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'implemented'
    approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    implemented_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Events (Audit Trail)
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_type VARCHAR(50), -- 'user', 'agent', 'system'
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    correlation_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50), -- 'ncr_review', 'capa_action', 'document_review', 'audit', 'custom'
    status VARCHAR(50) DEFAULT 'todo', -- 'todo', 'in_progress', 'review', 'done', 'cancelled'
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    related_entity_type VARCHAR(100),
    related_entity_id UUID,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sites_tenant ON sites(tenant_id);
CREATE INDEX idx_sites_organization ON sites(organization_id);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_site ON users(site_id);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_organization ON products(organization_id);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_organization ON customers(organization_id);
CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX idx_suppliers_organization ON suppliers(organization_id);
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_organization ON documents(organization_id);
CREATE INDEX idx_document_versions_document ON document_versions(document_id);
CREATE INDEX idx_nonconformities_tenant ON nonconformities(tenant_id);
CREATE INDEX idx_nonconformities_organization ON nonconformities(organization_id);
CREATE INDEX idx_nonconformities_status ON nonconformities(status);
CREATE INDEX idx_nonconformities_product ON nonconformities(product_id);
CREATE INDEX idx_nonconformities_site ON nonconformities(site_id);
CREATE INDEX idx_nonconformities_detected_at ON nonconformities(detected_at);
CREATE INDEX idx_ncr_attachments_ncr ON ncr_attachments(ncr_id);
CREATE INDEX idx_corrective_actions_ncr ON corrective_actions(ncr_id);
CREATE INDEX idx_corrective_actions_tenant ON corrective_actions(tenant_id);
CREATE INDEX idx_corrective_actions_organization ON corrective_actions(organization_id);
CREATE INDEX idx_corrective_actions_owner ON corrective_actions(owner_id);
CREATE INDEX idx_corrective_actions_due_date ON corrective_actions(due_date);
CREATE INDEX idx_effectiveness_checks_capa ON effectiveness_checks(capa_id);
CREATE INDEX idx_effectiveness_checks_tenant ON effectiveness_checks(tenant_id);
CREATE INDEX idx_effectiveness_checks_organization ON effectiveness_checks(organization_id);
CREATE INDEX idx_agent_runs_tenant ON agent_runs(tenant_id);
CREATE INDEX idx_agent_runs_organization ON agent_runs(organization_id);
CREATE INDEX idx_agent_recommendations_tenant ON agent_recommendations(tenant_id);
CREATE INDEX idx_agent_recommendations_organization ON agent_recommendations(organization_id);
CREATE INDEX idx_agent_recommendations_status ON agent_recommendations(status);
CREATE INDEX idx_audit_events_tenant ON audit_events(tenant_id);
CREATE INDEX idx_audit_events_organization ON audit_events(organization_id);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_created ON audit_events(created_at);
CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_organization ON tasks(organization_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Row Level Security Policies (for multi-tenant isolation)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nonconformities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncr_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrective_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE effectiveness_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (simplified - in production use session variables)
-- For development, we'll use a simple policy that allows all access
-- In production, replace with: USING (tenant_id = current_setting('app.current_tenant')::uuid)

CREATE POLICY org_isolation ON organizations USING (true);
CREATE POLICY sites_isolation ON sites USING (true);
CREATE POLICY users_isolation ON users USING (true);
CREATE POLICY products_isolation ON products USING (true);
CREATE POLICY customers_isolation ON customers USING (true);
CREATE POLICY suppliers_isolation ON suppliers USING (true);
CREATE POLICY documents_isolation ON documents USING (true);
CREATE POLICY doc_versions_isolation ON document_versions USING (true);
CREATE POLICY ncr_isolation ON nonconformities USING (true);
CREATE POLICY ncr_attach_isolation ON ncr_attachments USING (true);
CREATE POLICY capa_isolation ON corrective_actions USING (true);
CREATE POLICY eff_check_isolation ON effectiveness_checks USING (true);
CREATE POLICY agent_runs_isolation ON agent_runs USING (true);
CREATE POLICY agent_recs_isolation ON agent_recommendations USING (true);
CREATE POLICY audit_isolation ON audit_events USING (true);
CREATE POLICY tasks_isolation ON tasks USING (true);

-- Insert demo organization
INSERT INTO organizations (id, name, industry, timezone, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'מפעל הדגמה - פלסטיק עמית', 'פלסטיק', 'Asia/Jerusalem', 'active')
ON CONFLICT DO NOTHING;

-- Insert demo sites
INSERT INTO sites (id, tenant_id, organization_id, name, code, address, contact_person, contact_email) VALUES
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'קו ייצור 1', 'LINE-01', 'אזור תעשייה צפוני', 'דוד כהן', 'david@demo.com'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'קו ייצור 2', 'LINE-02', 'אזור תעשייה צפוני', 'שרה לוי', 'sarah@demo.com'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ביקורת קבלה', 'INCOMING', 'מחסן ראשי', 'משה אברהם', 'moshe@demo.com')
ON CONFLICT DO NOTHING;

-- Insert demo users (passwords handled by auth provider)
INSERT INTO users (id, tenant_id, organization_id, identity_id, email, full_name, role, site_id) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demo-admin', 'admin@demo.com', 'מנהל מערכת', 'admin', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demo-quality-mgr', 'quality@demo.com', 'אחראי איכות', 'quality_manager', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demo-inspector', 'inspector@demo.com', 'מבקר איכות', 'quality_inspector', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demo-worker', 'worker@demo.com', 'עובד ייצור', 'production_worker', 'cccccccc-cccc-cccc-cccc-cccccccccccc')
ON CONFLICT DO NOTHING;

-- Insert demo products
INSERT INTO products (id, tenant_id, organization_id, sku, name, description, revision, unit, category) VALUES
('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PRD-001', 'מכסה פלסטיק למיכל 500 מ"ל', 'מכסה הברגה עם אטם סיליקון', 'A', 'יחידה', 'מכסים'),
('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PRD-002', 'מיכל פלסטיק 500 מ"ל', 'מיכל עגול עם הברגה', 'B', 'יחידה', 'מיכלים'),
('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PRD-003', 'תווית מוצר סטנדרטית', 'תווית דביקה עמידות בחום', '1.0', 'יחידה', 'תוויות')
ON CONFLICT DO NOTHING;

-- Insert demo customers
INSERT INTO customers (id, tenant_id, organization_id, code, name, contact_person, contact_email, quality_requirements) VALUES
('66666666-6666-6666-6666-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CUST-001', 'חברת משקאות גדולה', 'רונית כהן', 'ronit@beverage.com', 'ISO 9001, בדיקות מימדיות מלאות, דוח חומרים'),
('77777777-7777-7777-7777-777777777777', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CUST-002', 'מפעל תרופות', 'ד"ר יוסי לוי', 'yossi@pharma.com', 'GMP, תיעוד מלא, ולידציית תהליך')
ON CONFLICT DO NOTHING;

-- Insert demo suppliers
INSERT INTO suppliers (id, tenant_id, organization_id, code, name, contact_person, contact_email, quality_rating, is_approved) VALUES
('88888888-8888-8888-8888-888888888888', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SUP-001', 'ספק פולימרים ראשי', 'אבי שרון', 'avi@polymer.com', 4.5, true),
('99999999-9999-9999-9999-999999999999', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SUP-002', 'ספק אטמים', 'מיכל רוזן', 'michal@seals.com', 4.2, true)
ON CONFLICT DO NOTHING;

-- Insert demo documents
INSERT INTO documents (id, tenant_id, organization_id, title, code, category, description, status, owner_id, approved_by_id, approved_at, effective_from) VALUES
('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'הוראת עבודה: הזרקת מכסים', 'WI-INJ-001', 'הוראות עבודה', 'תהליך הזרקה למכסה PRD-001', 'published', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff', NOW(), '2024-01-01'),
('bbbbbbbb-cccc-dddd-eeee-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'מפרט מוצר: מכסה PRD-001', 'SPEC-PRD-001', 'מפרטים', 'מידות, חומרים, בדיקות', 'published', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff', NOW(), '2024-01-01'),
('cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'נוהל טיפול באי התאמות', 'PROC-NCR-001', 'נהלים', 'תהליך זיהוי, דיווח וטיפול בחריגות', 'published', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', NOW(), '2024-01-01')
ON CONFLICT DO NOTHING;

-- Insert demo document versions
INSERT INTO document_versions (id, document_id, version, file_key, file_name, file_size, mime_type, uploaded_by_id, is_current) VALUES
('dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '1.0', 'docs/WI-INJ-001_v1.pdf', 'WI-INJ-001_v1.pdf', 102400, 'application/pdf', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true),
('eeeeeeee-ffff-aaaa-bbbb-cccccccccccc', 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', '1.0', 'docs/SPEC-PRD-001_v1.pdf', 'SPEC-PRD-001_v1.pdf', 204800, 'application/pdf', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true),
('ffffffff-aaaa-bbbb-cccc-dddddddddddd', 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa', '1.0', 'docs/PROC-NCR-001_v1.pdf', 'PROC-NCR-001_v1.pdf', 153600, 'application/pdf', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true)
ON CONFLICT DO NOTHING;

-- Insert demo nonconformities
INSERT INTO nonconformities (id, tenant_id, organization_id, number, title, description, severity, status, product_id, site_id, lot_number, defect_code, defect_description, measured_value, unit, detected_by_id, detected_at, assigned_to_id) VALUES
('11111111-aaaa-bbbb-cccc-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NCR-1042', 'סטייה במידות מוצר', 'קוטר חיצוני של המכסה נמדד 52.8 מ"מ, חריגה של 0.3 מ"מ מהמפרט (52.5 מ"מ מקסימום)', 'major', 'open', '33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'LOT-2026-014', 'DIM-001', 'קוטר חיצוני חורג', 52.8, 'מ"מ', '11111111-1111-1111-1111-111111111111', '2026-10-15 08:30:00+03', 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
('22222222-bbbb-cccc-dddd-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NCR-1041', 'פגם בגימור פני שטח', 'שריטות על המשטח העליון של המכסה, נראות לעין', 'minor', 'investigating', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'LOT-2026-013', 'SURF-002', 'שריטות בגימור', NULL, NULL, '11111111-1111-1111-1111-111111111111', '2026-10-14 14:20:00+03', 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
('33333333-cccc-dddd-eeee-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NCR-1040', 'חוסר בתיעוד בדיקה', 'לא מולא טופס ביקורת קבלה לאצווה LOT-2026-012', 'observation', 'closed', '44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'LOT-2026-012', 'DOC-001', 'חוסר תיעוד', NULL, NULL, '22222222-2222-2222-2222-222222222222', '2026-10-10 09:00:00+03', 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
('44444444-dddd-eeee-ffff-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NCR-1039', 'סטייה במידות - אצווה קודמת', 'אותו פגם קוטר חיצוני באצווה קודמת', 'major', 'closed', '33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'LOT-2026-011', 'DIM-001', 'קוטר חיצוני חורג', 52.7, 'מ"מ', '11111111-1111-1111-1111-111111111111', '2026-10-08 10:15:00+03', 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
('55555555-eeee-ffff-aaaa-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NCR-1038', 'סטייה במידות - אצווה נוספת', 'קוטר חיצוני 52.9 מ"מ', 'major', 'closed', '33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'LOT-2026-010', 'DIM-001', 'קוטר חיצוני חורג', 52.9, 'מ"מ', '11111111-1111-1111-1111-111111111111', '2026-10-05 11:00:00+03', 'ffffffff-ffff-ffff-ffff-ffffffffffff')
ON CONFLICT DO NOTHING;

-- Insert demo corrective actions
INSERT INTO corrective_actions (id, ncr_id, tenant_id, organization_id, title, description, action_type, status, owner_id, due_date, started_at) VALUES
('66666666-ffff-aaaa-bbbb-cccccccccccc', '11111111-aaaa-bbbb-cccc-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'כיול תבנית הזרקה', 'ביצוע כיול מלא לתבנית מכסה PRD-001 בקו ייצור 2', 'corrective_action', 'in_progress', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '2026-10-25', '2026-10-16 08:00:00+03'),
('77777777-aaaa-bbbb-cccc-dddddddddddd', '22222222-bbbb-cccc-dddd-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ניקוי תבנית ובדיקת שחיקה', 'ניקוי יסודי של משטחי התבנית ובדיקת בלאי', 'correction', 'assigned', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '2026-10-20', NULL),
('88888888-bbbb-cccc-dddd-eeeeeeeeeeee', '33333333-cccc-dddd-eeee-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'הדרכת עובדים על מילוי טפסים', 'רענון נוהל ביקורת קבלה לכל העובדים', 'preventive_action', 'completed', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '2026-10-15', '2026-10-11 08:00:00+03')
ON CONFLICT DO NOTHING;

-- Insert demo effectiveness checks
INSERT INTO effectiveness_checks (id, capa_id, tenant_id, organization_id, check_date, result, evidence, checked_by_id) VALUES
('99999999-cccc-dddd-eeee-ffffffffffff', '88888888-bbbb-cccc-dddd-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-10-18', true, 'כל טופסי ביקורת הקבלה מולאו כראוי בשבוע האחרון', 'ffffffff-ffff-ffff-ffff-ffffffffffff')
ON CONFLICT DO NOTHING;

-- Insert demo agent runs
INSERT INTO agent_runs (id, tenant_id, organization_id, trigger_type, trigger_details, status, started_at, completed_at, result_summary) VALUES
('aaaaaaaa-1111-2222-3333-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'scheduled', '{"type": "daily_check", "date": "2026-10-19"}', 'completed', '2026-10-19 06:00:00+03', '2026-10-19 06:02:15+03', '{"findings": 2, "recommendations_created": 1, "alerts_sent": 1}')
ON CONFLICT DO NOTHING;

-- Insert demo agent recommendations
INSERT INTO agent_recommendations (id, run_id, tenant_id, organization_id, type, severity, title, description, rationale, confidence, evidence, missing_information, recommended_action, status) VALUES
('bbbbbbbb-2222-3333-4444-555555555555', 'aaaaaaaa-1111-2222-3333-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'repeated_defect', 'warning', 'פגם חוזר: קוטר חיצוני מכסה PRD-001', 'זוהו 3 חריגות של קוטר חיצוני חורג במוצר PRD-001 ב-7 ימים אחרונים (NCR-1042, NCR-1039, NCR-1038)', 'אותו קוד פגם DIM-001 חוזר באותו מוצר ובאותו קו ייצור, מצביע על בעיה שיטתית', 'high', '[{"type": "ncr", "id": "11111111-aaaa-bbbb-cccc-dddddddddddd", "number": "NCR-1042"}, {"type": "ncr", "id": "44444444-dddd-eeee-ffff-aaaaaaaaaaaa", "number": "NCR-1039"}, {"type": "ncr", "id": "55555555-eeee-ffff-aaaa-bbbbbbbbbbbb", "number": "NCR-1038"}]', '["נתוני כיול תבנית עדכניים", "רשומות משמרת מפעיל"]', '{"type": "START_RCA", "reason": "Recurring dimensional deviation", "requires_approval": true}', 'pending'),
('cccccccc-3333-4444-5555-666666666666', 'aaaaaaaa-1111-2222-3333-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'overdue_capa', 'info', 'פעולה מתקנת באיחור: ניקוי תבנית', 'CAPA ניקוי תבנית (NCR-1041) אמורה להסתיים ב-2026-10-20, טרם התחילה', 'מועד היעד מתקרב והפעולה לא התחילה', 'medium', '[{"type": "capa", "id": "77777777-aaaa-bbbb-cccc-dddddddddddd"}]', '[]', '{"type": "REMIND_OWNER", "reason": "Due date approaching", "requires_approval": false}', 'pending')
ON CONFLICT DO NOTHING;

-- Insert demo tasks
INSERT INTO tasks (id, tenant_id, organization_id, title, description, task_type, status, priority, assignee_id, reporter_id, related_entity_type, related_entity_id, due_date) VALUES
('dddddddd-4444-5555-6666-777777777777', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'השלמת כיול תבנית מכסה PRD-001', 'ביצוע כיול מלא ובדיקת דגימות ראשונות', 'capa_action', 'in_progress', 'high', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'corrective_action', '66666666-ffff-aaaa-bbbb-cccccccccccc', '2026-10-25 17:00:00+03'),
('eeeeeeee-5555-6666-7777-888888888888', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'אישור המלצת AI: תחקיר פגם חוזר', 'אישור או דחייה של המלצה לפתיחת RCA חדש', 'ncr_review', 'todo', 'high', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'agent_recommendation', 'bbbbbbbb-2222-3333-4444-555555555555', '2026-10-22 17:00:00+03'),
('ffffffff-6666-7777-8888-999999999999', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'התחלת ניקוי תבנית קו 1', 'ניקוי תבנית לפי CAPA של NCR-1041', 'capa_action', 'todo', 'medium', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'corrective_action', '77777777-aaaa-bbbb-cccc-dddddddddddd', '2026-10-20 17:00:00+03')
ON CONFLICT DO NOTHING;

-- Insert demo audit events
INSERT INTO audit_events (id, tenant_id, organization_id, actor_id, actor_type, action, entity_type, entity_id, new_values) VALUES
('11111111-2222-3333-4444-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'user', 'CREATE', 'nonconformity', '11111111-aaaa-bbbb-cccc-dddddddddddd', '{"number": "NCR-1042", "title": "סטייה במידות מוצר", "severity": "major"}'),
('22222222-3333-4444-5555-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'user', 'ASSIGN', 'nonconformity', '11111111-aaaa-bbbb-cccc-dddddddddddd', '{"assigned_to_id": "ffffffff-ffff-ffff-ffff-ffffffffffff"}'),
('33333333-4444-5555-6666-777777777777', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'agent', 'CREATE_RECOMMENDATION', 'agent_recommendation', 'bbbbbbbb-2222-3333-4444-555555555555', '{"type": "repeated_defect", "title": "פגם חוזר: קוטר חיצוני מכסה PRD-001"}')
ON CONFLICT DO NOTHING;

-- Ensure all tables that use TimestampMixin have updated_at
ALTER TABLE ncr_attachments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE effectiveness_checks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE agent_recommendations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nonconformities_updated_at BEFORE UPDATE ON nonconformities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_corrective_actions_updated_at BEFORE UPDATE ON corrective_actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO qualityagent;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO qualityagent;

-- ============================================================
-- Quality inspections module (plans, inspections, results)
-- ============================================================

DO $$ BEGIN
    CREATE TYPE inspection_type AS ENUM ('incoming', 'in_process', 'final', 'audit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE inspection_status AS ENUM ('planned', 'in_progress', 'passed', 'failed', 'on_hold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE inspection_result AS ENUM ('pass', 'fail', 'na');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS inspection_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    inspection_type inspection_type NOT NULL DEFAULT 'in_process',
    frequency VARCHAR(50) NOT NULL DEFAULT 'per_lot',
    sample_size INTEGER NOT NULL DEFAULT 5,
    characteristics JSON NOT NULL DEFAULT '[]'::json,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inspection_plan_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    number VARCHAR(50) NOT NULL,
    inspection_type inspection_type NOT NULL DEFAULT 'in_process',
    status inspection_status NOT NULL DEFAULT 'planned',
    plan_id UUID REFERENCES inspection_plans(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    lot_number VARCHAR(100),
    inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    sample_size INTEGER NOT NULL DEFAULT 5,
    passed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    ncr_id UUID REFERENCES nonconformities(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inspection_tenant_number UNIQUE (tenant_id, number)
);

CREATE TABLE IF NOT EXISTS inspection_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    characteristic VARCHAR(255) NOT NULL,
    nominal NUMERIC(15, 5),
    tolerance_plus NUMERIC(15, 5),
    tolerance_minus NUMERIC(15, 5),
    measured_value NUMERIC(15, 5),
    unit VARCHAR(20),
    result inspection_result NOT NULL DEFAULT 'pass',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_plans_tenant ON inspection_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspection_plans_organization ON inspection_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_inspection_plans_type ON inspection_plans(inspection_type);
CREATE INDEX IF NOT EXISTS idx_inspections_tenant ON inspections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspections_organization ON inspections(organization_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_type ON inspections(inspection_type);
CREATE INDEX IF NOT EXISTS idx_inspections_plan ON inspections(plan_id);
CREATE INDEX IF NOT EXISTS idx_inspections_product ON inspections(product_id);
CREATE INDEX IF NOT EXISTS idx_inspections_site ON inspections(site_id);
CREATE INDEX IF NOT EXISTS idx_inspections_created_at ON inspections(created_at);
CREATE INDEX IF NOT EXISTS idx_inspection_results_inspection ON inspection_results(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_results_tenant ON inspection_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspection_results_result ON inspection_results(result);

ALTER TABLE inspection_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY inspection_plans_isolation ON inspection_plans USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY inspections_isolation ON inspections USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY inspection_results_isolation ON inspection_results USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_inspection_plans_updated_at ON inspection_plans;
CREATE TRIGGER update_inspection_plans_updated_at BEFORE UPDATE ON inspection_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_inspections_updated_at ON inspections;
CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON inspections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_inspection_results_updated_at ON inspection_results;
CREATE TRIGGER update_inspection_results_updated_at BEFORE UPDATE ON inspection_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------ demo seed
INSERT INTO inspection_plans (id, tenant_id, organization_id, code, name, description, inspection_type, frequency, sample_size, characteristics, product_id, site_id, is_active) VALUES
('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'IP-001', 'בדיקת קבלה - חומרי גלם', 'בדיקת משלוחי חומר גלם לפני קליטה למחסן', 'incoming', 'per_lot', 5,
 '["משקל","מידות","צבע","אריזה"]'::json, NULL, 'dddddddd-dddd-dddd-dddd-dddddddddddd', TRUE),
('a0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'IP-002', 'בדיקת תהליך - קו ייצור 1', 'בקרת תהליך שוטפת כל שעתיים בקו 1', 'in_process', 'every_2_hours', 3,
 '["טמפרטורה","לחץ","משקל","ממדים"]'::json, '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', TRUE),
('a0000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'IP-003', 'בדיקת מוצר סופי - מיכל 500 מ"ל', 'בדיקות סופיות לכל אצווה לפני אריזה ומשלוח', 'final', 'per_batch', 8,
 '["נפח","אטימות","מידות","הדפסה"]'::json, '44444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO inspections (id, tenant_id, organization_id, number, inspection_type, status, plan_id, product_id, site_id, lot_number, inspector_id, inspected_at, completed_at, sample_size, passed_count, failed_count, notes) VALUES
('b0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'INS-2026-0001', 'incoming', 'passed', 'a0000000-0000-4000-8000-000000000001', NULL, 'dddddddd-dddd-dddd-dddd-dddddddddddd',
 'LOT-2026-101', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days', 6, 6, 0,
 'כל המאפיינים בטווח הסובלנות'),
('b0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'INS-2026-0002', 'in_process', 'passed', 'a0000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
 'LOT-2026-102', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', 5, 5, 0,
 'בדיקת תהליך תקינה'),
('b0000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'INS-2026-0003', 'final', 'failed', 'a0000000-0000-4000-8000-000000000003', '44444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
 'LOT-2026-103', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days', 5, 4, 1,
 'נמצא חריג באטימות - נפתחה אי-התאמה'),
('b0000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'INS-2026-0004', 'in_process', 'in_progress', 'a0000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
 'LOT-2026-104', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '2 days', NULL, 4, 4, 0,
 'בדיקה בעיצומה'),
('b0000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'INS-2026-0005', 'incoming', 'planned', 'a0000000-0000-4000-8000-000000000001', NULL, 'dddddddd-dddd-dddd-dddd-dddddddddddd',
 'LOT-2026-105', '11111111-1111-1111-1111-111111111111', NULL, NULL, 5, 0, 0,
 'מתוכננת לשבוע הבא'),
('b0000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'INS-2026-0006', 'final', 'planned', 'a0000000-0000-4000-8000-000000000003', '44444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
 'LOT-2026-106', '11111111-1111-1111-1111-111111111111', NULL, NULL, 8, 0, 0,
 'מתוכננת לבדיקה סופית')
ON CONFLICT DO NOTHING;

INSERT INTO inspection_results (tenant_id, organization_id, inspection_id, characteristic, nominal, tolerance_plus, tolerance_minus, measured_value, unit, result, notes) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000001', 'משקל', 25.000, 0.500, 0.500, 25.120, 'גר', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000001', 'אורך', 120.000, 1.000, 1.000, 120.400, 'מ"מ', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000001', 'רוחב', 80.000, 1.000, 1.000, 79.700, 'מ"מ', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000001', 'גוון', NULL, NULL, NULL, NULL, NULL, 'pass', 'תואם לדגם'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000001', 'אריזה', NULL, NULL, NULL, NULL, NULL, 'pass', 'אריזה שלמה'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000001', 'לחות', 0.200, 0.050, 0.000, 0.180, '%', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000002', 'טמפרטורה', 210.000, 5.000, 5.000, 212.000, '°C', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000002', 'לחץ', 45.000, 2.000, 2.000, 45.800, 'בר', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000002', 'משקל', 24.800, 0.400, 0.400, 24.900, 'גר', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000002', 'עובי דופן', 1.200, 0.100, 0.100, 1.230, 'מ"מ', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000002', 'ממד', 95.000, 0.500, 0.500, 94.800, 'מ"מ', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000003', 'נפח', 500.000, 5.000, 5.000, 501.500, 'מ"ל', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000003', 'אטימות', 0.000, 0.000, 0.000, 2.300, 'מ"ל/דקה', 'fail', 'נמצאה דליפה בבדיקת לחץ'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000003', 'מידות חיצוניות', 110.000, 0.800, 0.800, 110.300, 'מ"מ', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000003', 'הדפסה', NULL, NULL, NULL, NULL, NULL, 'pass', 'הדפסה ברורה'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000003', 'צבע', NULL, NULL, NULL, NULL, NULL, 'pass', 'תואם לדגם'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000004', 'טמפרטורה', 210.000, 5.000, 5.000, 209.400, '°C', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000004', 'לחץ', 45.000, 2.000, 2.000, 44.600, 'בר', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000004', 'משקל', 24.800, 0.400, 0.400, 24.750, 'גר', 'pass', NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000004', 'עובי דופן', 1.200, 0.100, 0.100, 1.190, 'מ"מ', 'pass', NULL);

-- ============================================================
-- Customer complaints module
-- ============================================================

DO $$ BEGIN
    CREATE TYPE complaint_status AS ENUM ('new', 'under_review', 'investigating', 'action_pending', 'resolved', 'closed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE complaint_severity AS ENUM ('critical', 'major', 'minor', 'observation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    number VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status complaint_status NOT NULL DEFAULT 'new',
    severity complaint_severity NOT NULL DEFAULT 'minor',
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    lot_number VARCHAR(100),
    customer_reference VARCHAR(100),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    resolution TEXT,
    root_cause TEXT,
    ncr_id UUID REFERENCES nonconformities(id) ON DELETE SET NULL,
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_complaint_tenant_number UNIQUE (tenant_id, number)
);

CREATE INDEX IF NOT EXISTS idx_complaints_tenant ON complaints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_complaints_organization ON complaints(organization_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_severity ON complaints(severity);
CREATE INDEX IF NOT EXISTS idx_complaints_customer ON complaints(customer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_product ON complaints(product_id);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to ON complaints(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_complaints_ncr ON complaints(ncr_id);
CREATE INDEX IF NOT EXISTS idx_complaints_received_at ON complaints(received_at);
CREATE INDEX IF NOT EXISTS idx_complaints_due_date ON complaints(due_date);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY complaints_isolation ON complaints USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_complaints_updated_at ON complaints;
CREATE TRIGGER update_complaints_updated_at BEFORE UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------ demo seed
INSERT INTO complaints (id, tenant_id, organization_id, number, title, description, status, severity, customer_id, product_id, lot_number, customer_reference, received_at, due_date, assigned_to_id, acknowledged_at, resolved_at, closed_at, resolution, root_cause, ncr_id, satisfaction_rating) VALUES
('e0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'CMP-2026-0001', 'דליפת נוזל מהמיכל באריזה', 'הלקוח מדווח על דליפה מהמיכלים במשלוח האחרון. כ-12 מיכלים מתוך 500 הגיעו פגומים.',
 'new', 'critical', '66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'LOT-2026-103', 'REF-BEV-8821',
 NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 'ffffffff-ffff-ffff-ffff-ffffffffffff', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('e0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'CMP-2026-0002', 'אי-התאמה בתווית המוצר', 'תוויות עם קוד אצווה שגוי התקבלו באריזה. הלקוח דורש החלפה או זיכוי.',
 'under_review', 'major', '77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'LOT-2026-106', 'REF-PHR-4410',
 NOW() - INTERVAL '4 days', NOW() + INTERVAL '3 days', 'ffffffff-ffff-ffff-ffff-ffffffffffff', NOW() - INTERVAL '3 days', NULL, NULL, NULL, NULL, NULL, NULL),
('e0000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'CMP-2026-0003', 'סטייה במידות המכסה', 'המכסים אינם מתיישבים על המיכל. נמדד קוטר חיצוני חורג מהמפרט.',
 'investigating', 'major', '66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'LOT-2026-014', 'REF-BEV-8790',
 NOW() - INTERVAL '9 days', NOW() - INTERVAL '2 days', 'ffffffff-ffff-ffff-ffff-ffffffffffff', NOW() - INTERVAL '8 days', NULL, NULL, NULL, NULL, '11111111-aaaa-bbbb-cccc-dddddddddddd', NULL),
('e0000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'CMP-2026-0004', 'שריטות על פני המכסה', 'שריטות עדינות על המשטח העליון של חלק מהמכסים באריזה.',
 'action_pending', 'minor', '77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', 'LOT-2026-013', 'REF-PHR-4372',
 NOW() - INTERVAL '14 days', NOW() + INTERVAL '5 days', 'ffffffff-ffff-ffff-ffff-ffffffffffff', NOW() - INTERVAL '13 days', NULL, NULL, NULL, 'בלאי בתבנית ההזרקה', NULL, NULL),
('e0000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'CMP-2026-0005', 'אריזה פגומה במשלוח', 'קרטונים חיצוניים הגיעו מעוכים, חלק מהמוצרים נפגעו.',
 'resolved', 'minor', '66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'LOT-2026-099', 'REF-BEV-8711',
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '6 days', 'ffffffff-ffff-ffff-ffff-ffffffffffff', NOW() - INTERVAL '19 days', NOW() - INTERVAL '16 days', NULL,
 'הוחלף מלאי פגום וזוכה הלקוח. חוזקה אריזת הקרטון.', 'עומס יתר על משטח האריזה', NULL, 4),
('e0000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'CMP-2026-0006', 'בקשה לתיעוד בדיקות', 'הלקוח ביקש תיעוד בדיקות קבלה עבור אצווה שנשלחה.',
 'closed', 'observation', '77777777-7777-7777-7777-777777777777', '44444444-4444-4444-4444-444444444444', 'LOT-2026-090', 'REF-PHR-4301',
 NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days', 'ffffffff-ffff-ffff-ffff-ffffffffffff', NOW() - INTERVAL '29 days', NOW() - INTERVAL '26 days', NOW() - INTERVAL '25 days',
 'הועבר תיעוד בדיקות מלא ללקוח.', 'חוסר בתהליך שליחת תיעוד אוטומטי', NULL, 5)
ON CONFLICT DO NOTHING;
