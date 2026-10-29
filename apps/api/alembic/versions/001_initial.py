"""Initial migration

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Create custom enums
    op.execute("CREATE TYPE organization_status AS ENUM ('active', 'inactive', 'trial')")
    op.execute("CREATE TYPE user_role AS ENUM ('admin', 'quality_manager', 'quality_inspector', 'production_worker', 'viewer')")
    op.execute("CREATE TYPE ncr_status AS ENUM ('draft', 'open', 'contained', 'investigating', 'action_pending', 'effectiveness_review', 'closed', 'reopened')")
    op.execute("CREATE TYPE ncr_severity AS ENUM ('critical', 'major', 'minor', 'observation')")
    op.execute("CREATE TYPE capa_status AS ENUM ('draft', 'assigned', 'in_progress', 'pending_review', 'effectiveness_check', 'completed', 'rejected')")
    op.execute("CREATE TYPE document_status AS ENUM ('draft', 'under_review', 'approved', 'published', 'archived', 'obsolete')")
    op.execute("CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done', 'cancelled')")
    op.execute("CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent')")
    op.execute("CREATE TYPE agent_run_status AS ENUM ('pending', 'running', 'completed', 'failed')")
    op.execute("CREATE TYPE agent_recommendation_type AS ENUM ('repeated_defect', 'overdue_capa', 'document_expiry', 'trend_alert', 'rca_suggestion', 'inspection_schedule', 'supplier_alert')")
    op.execute("CREATE TYPE agent_recommendation_status AS ENUM ('pending', 'approved', 'rejected', 'implemented')")

    # Organizations
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('industry', sa.String(100), nullable=True),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='Asia/Jerusalem'),
        sa.Column('status', sa.Enum('active', 'inactive', 'trial', name='organization_status'), nullable=False, server_default='active'),
        sa.Column('settings', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )

    # Sites
    op.create_table(
        'sites',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),
        sa.Column('address', sa.Text, nullable=True),
        sa.Column('contact_person', sa.String(255), nullable=True),
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_site_tenant_code'),
    )
    op.create_index('idx_sites_tenant', 'sites', ['tenant_id'])

    # Users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('identity_id', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('role', sa.Enum('admin', 'quality_manager', 'quality_inspector', 'production_worker', 'viewer', name='user_role'), nullable=False, server_default='viewer'),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('avatar_url', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('tenant_id', 'identity_id', name='uq_user_tenant_identity'),
        sa.UniqueConstraint('tenant_id', 'email', name='uq_user_tenant_email'),
    )
    op.create_index('idx_users_tenant', 'users', ['tenant_id'])
    op.create_index('idx_users_site', 'users', ['site_id'])

    # Products
    op.create_table(
        'products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sku', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('revision', sa.String(50), nullable=False, server_default='1.0'),
        sa.Column('unit', sa.String(20), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('drawing_number', sa.String(100), nullable=True),
        sa.Column('specification', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('tenant_id', 'sku', name='uq_product_tenant_sku'),
    )
    op.create_index('idx_products_tenant', 'products', ['tenant_id'])

    # Customers
    op.create_table(
        'customers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('contact_person', sa.String(255), nullable=True),
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(50), nullable=True),
        sa.Column('address', sa.Text, nullable=True),
        sa.Column('quality_requirements', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_customer_tenant_code'),
    )
    op.create_index('idx_customers_tenant', 'customers', ['tenant_id'])

    # Suppliers
    op.create_table(
        'suppliers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('contact_person', sa.String(255), nullable=True),
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(50), nullable=True),
        sa.Column('address', sa.Text, nullable=True),
        sa.Column('quality_rating', sa.Numeric(3, 2), nullable=True),
        sa.Column('is_approved', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_supplier_tenant_code'),
    )
    op.create_index('idx_suppliers_tenant', 'suppliers', ['tenant_id'])

    # Documents
    op.create_table(
        'documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('code', sa.String(100), nullable=False),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', sa.Enum('draft', 'under_review', 'approved', 'published', 'archived', 'obsolete', name='document_status'), nullable=False, server_default='draft'),
        sa.Column('current_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('effective_from', sa.Date, nullable=True),
        sa.Column('effective_until', sa.Date, nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_document_tenant_code'),
    )
    op.create_index('idx_documents_tenant', 'documents', ['tenant_id'])

    # Document Versions
    op.create_table(
        'document_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version', sa.String(50), nullable=False),
        sa.Column('file_key', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_size', sa.BigInteger, nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('checksum', sa.String(64), nullable=True),
        sa.Column('change_summary', sa.Text, nullable=True),
        sa.Column('uploaded_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_current', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('document_id', 'version', name='uq_doc_version_doc_ver'),
    )
    op.create_index('idx_document_versions_document', 'document_versions', ['document_id'])

    # Add FK for documents.current_version_id
    op.create_foreign_key(
        'fk_documents_current_version',
        'documents', 'document_versions',
        ['current_version_id'], ['id'],
        ondelete='SET NULL'
    )

    # Nonconformities
    op.create_table(
        'nonconformities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('number', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('severity', sa.Enum('critical', 'major', 'minor', 'observation', name='ncr_severity'), nullable=False, server_default='minor'),
        sa.Column('status', sa.Enum('draft', 'open', 'contained', 'investigating', 'action_pending', 'effectiveness_review', 'closed', 'reopened', name='ncr_status'), nullable=False, server_default='draft'),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('lot_number', sa.String(100), nullable=True),
        sa.Column('serial_number', sa.String(100), nullable=True),
        sa.Column('defect_code', sa.String(50), nullable=True),
        sa.Column('defect_description', sa.Text, nullable=True),
        sa.Column('measured_value', sa.Numeric(15, 5), nullable=True),
        sa.Column('unit', sa.String(20), nullable=True),
        sa.Column('requirement_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('detected_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('detected_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('assigned_to_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('contained_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('contained_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('containment_action', sa.Text, nullable=True),
        sa.Column('root_cause', sa.Text, nullable=True),
        sa.Column('root_cause_analysis_method', sa.String(100), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('closure_notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['requirement_version_id'], ['document_versions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['detected_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_to_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['contained_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['closed_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('tenant_id', 'number', name='uq_ncr_tenant_number'),
    )
    op.create_index('idx_nonconformities_tenant', 'nonconformities', ['tenant_id'])
    op.create_index('idx_nonconformities_status', 'nonconformities', ['status'])
    op.create_index('idx_nonconformities_product', 'nonconformities', ['product_id'])
    op.create_index('idx_nonconformities_site', 'nonconformities', ['site_id'])
    op.create_index('idx_nonconformities_detected_at', 'nonconformities', ['detected_at'])

    # NCR Attachments
    op.create_table(
        'ncr_attachments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('ncr_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_key', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_size', sa.BigInteger, nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('uploaded_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['ncr_id'], ['nonconformities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_ncr_attachments_ncr', 'ncr_attachments', ['ncr_id'])

    # Corrective Actions
    op.create_table(
        'corrective_actions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('ncr_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum('draft', 'assigned', 'in_progress', 'pending_review', 'effectiveness_check', 'completed', 'rejected', name='capa_status'), nullable=False, server_default='draft'),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('due_date', sa.Date, nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verified_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_notes', sa.Text, nullable=True),
        sa.Column('effectiveness_check_date', sa.Date, nullable=True),
        sa.Column('effectiveness_result', sa.Boolean, nullable=True),
        sa.Column('effectiveness_evidence', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['ncr_id'], ['nonconformities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['verified_by_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_corrective_actions_ncr', 'corrective_actions', ['ncr_id'])
    op.create_index('idx_corrective_actions_tenant', 'corrective_actions', ['tenant_id'])
    op.create_index('idx_corrective_actions_owner', 'corrective_actions', ['owner_id'])
    op.create_index('idx_corrective_actions_due_date', 'corrective_actions', ['due_date'])

    # Effectiveness Checks
    op.create_table(
        'effectiveness_checks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('capa_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('check_date', sa.Date, nullable=False),
        sa.Column('result', sa.Boolean, nullable=False),
        sa.Column('evidence', sa.Text, nullable=True),
        sa.Column('checked_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['capa_id'], ['corrective_actions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['checked_by_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_effectiveness_checks_capa', 'effectiveness_checks', ['capa_id'])

    # Agent Runs
    op.create_table(
        'agent_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('trigger_type', sa.String(50), nullable=False),
        sa.Column('trigger_details', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('status', sa.Enum('pending', 'running', 'completed', 'failed', name='agent_run_status'), nullable=False, server_default='pending'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('result_summary', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_agent_runs_tenant', 'agent_runs', ['tenant_id'])

    # Agent Recommendations
    op.create_table(
        'agent_recommendations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.Enum('repeated_defect', 'overdue_capa', 'document_expiry', 'trend_alert', 'rca_suggestion', 'inspection_schedule', 'supplier_alert', name='agent_recommendation_type'), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('rationale', sa.Text, nullable=True),
        sa.Column('confidence', sa.String(20), nullable=True),
        sa.Column('evidence', postgresql.JSONB, nullable=False, server_default='[]'),
        sa.Column('missing_information', postgresql.JSONB, nullable=False, server_default='[]'),
        sa.Column('recommended_action', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('status', sa.Enum('pending', 'approved', 'rejected', 'implemented', name='agent_recommendation_status'), nullable=False, server_default='pending'),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('implemented_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['run_id'], ['agent_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_agent_recommendations_tenant', 'agent_recommendations', ['tenant_id'])
    op.create_index('idx_agent_recommendations_status', 'agent_recommendations', ['status'])

    # Audit Events
    op.create_table(
        'audit_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('actor_type', sa.String(50), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('old_values', postgresql.JSONB, nullable=True),
        sa.Column('new_values', postgresql.JSONB, nullable=True),
        sa.Column('ip_address', postgresql.INET, nullable=True),
        sa.Column('user_agent', sa.Text, nullable=True),
        sa.Column('correlation_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_audit_events_tenant', 'audit_events', ['tenant_id'])
    op.create_index('idx_audit_events_entity', 'audit_events', ['entity_type', 'entity_id'])
    op.create_index('idx_audit_events_created', 'audit_events', ['created_at'])

    # Tasks
    op.create_table(
        'tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('task_type', sa.String(50), nullable=True),
        sa.Column('status', sa.Enum('todo', 'in_progress', 'review', 'done', 'cancelled', name='task_status'), nullable=False, server_default='todo'),
        sa.Column('priority', sa.Enum('low', 'medium', 'high', 'urgent', name='task_priority'), nullable=False, server_default='medium'),
        sa.Column('assignee_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reporter_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('related_entity_type', sa.String(100), nullable=True),
        sa.Column('related_entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_tasks_tenant', 'tasks', ['tenant_id'])
    op.create_index('idx_tasks_assignee', 'tasks', ['assignee_id'])
    op.create_index('idx_tasks_status', 'tasks', ['status'])

    # Updated_at triggers
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)

    tables_with_updated_at = [
        'organizations', 'sites', 'users', 'products', 'customers', 'suppliers',
        'documents', 'nonconformities', 'corrective_actions', 'tasks'
    ]

    for table in tables_with_updated_at:
        op.execute(f"""
            CREATE TRIGGER update_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        """)

    # Grant permissions
    op.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO qualityagent")
    op.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO qualityagent")


def downgrade() -> None:
    # Drop triggers
    tables_with_updated_at = [
        'organizations', 'sites', 'users', 'products', 'customers', 'suppliers',
        'documents', 'nonconformities', 'corrective_actions', 'tasks'
    ]
    for table in tables_with_updated_at:
        op.execute(f"DROP TRIGGER IF EXISTS update_{table}_updated_at ON {table}")

    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")

    # Drop tables in reverse order
    op.drop_table('tasks')
    op.drop_table('audit_events')
    op.drop_table('agent_recommendations')
    op.drop_table('agent_runs')
    op.drop_table('effectiveness_checks')
    op.drop_table('corrective_actions')
    op.drop_table('ncr_attachments')
    op.drop_table('nonconformities')
    op.drop_table('document_versions')
    op.drop_table('documents')
    op.drop_table('suppliers')
    op.drop_table('customers')
    op.drop_table('products')
    op.drop_table('users')
    op.drop_table('sites')
    op.drop_table('organizations')

    # Drop enums
    op.execute("DROP TYPE IF EXISTS task_priority")
    op.execute("DROP TYPE IF EXISTS task_status")
    op.execute("DROP TYPE IF EXISTS agent_recommendation_status")
    op.execute("DROP TYPE IF EXISTS agent_recommendation_type")
    op.execute("DROP TYPE IF EXISTS agent_run_status")
    op.execute("DROP TYPE IF EXISTS capa_status")
    op.execute("DROP TYPE IF EXISTS ncr_severity")
    op.execute("DROP TYPE IF EXISTS ncr_status")
    op.execute("DROP TYPE IF EXISTS user_role")
    op.execute("DROP TYPE IF EXISTS organization_status")
    op.execute("DROP TYPE IF EXISTS document_status")