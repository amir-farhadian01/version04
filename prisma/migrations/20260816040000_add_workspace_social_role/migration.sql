-- CreateTable: WorkspaceSocialRole — social roles granted within a workspace
CREATE TABLE "WorkspaceSocialRole" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "WorkspaceSocialRole_pkey" PRIMARY KEY ("id")
);
