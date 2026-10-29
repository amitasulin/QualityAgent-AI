"""Main API router"""
from fastapi import APIRouter

from app.api.v1 import (
    organizations,
    sites,
    users,
    products,
    customers,
    suppliers,
    documents,
    nonconformities,
    corrective_actions,
    inspections,
    complaints,
    agent,
    tasks,
    dashboard,
    auth,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
api_router.include_router(sites.router, prefix="/sites", tags=["Sites"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(nonconformities.router, prefix="/nonconformities", tags=["Nonconformities"])
api_router.include_router(corrective_actions.router, prefix="/corrective-actions", tags=["Corrective Actions"])
api_router.include_router(inspections.router, prefix="/inspections", tags=["Inspections"])
api_router.include_router(complaints.router, prefix="/complaints", tags=["Complaints"])
api_router.include_router(agent.router, prefix="/agent", tags=["AI Agent"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])