-- ============================================================================
-- TASK REPORTS FEATURE - COMPLETE SCHEMA MIGRATION
-- ============================================================================
-- This migration adds comprehensive task reporting capabilities for service
-- providers to report on task progress and managers to review/approve work.
--
-- Key Tables:
--   1. task_checklists - Defines checklist items for a task
--   2. task_evidence_requirements - Specifies required evidence types
--   3. task_reports - Main report submitted by service provider
--   4. report_checklist_items - Progress on checklist items
--   5. report_evidence - Uploaded photos/videos as proof
--   6. task_issues - Issues/challenges raised during task execution
--   7. report_activity_log - Detailed audit trail of report actions
--
-- RLS Policies:
--   - Service providers can create/update reports for their assigned tasks
--   - Managers can view reports for tasks they created
--   - All appropriate users notified of status changes
--
-- ============================================================================

-- ============================================================================
-- 1. CREATE task_checklists TABLE
-- ============================================================================
-- Stores checklist items that can be optionally defined by manager when creating task
-- One task can have multiple checklist items

CREATE TABLE IF NOT EXISTS public.task_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  order_index INT NOT NULL DEFAULT 0,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT task_checklists_pkey PRIMARY KEY (id),
  CONSTRAINT task_checklists_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_checklists_task_id 
  ON public.task_checklists USING btree (task_id);

-- ============================================================================
-- 2. CREATE task_evidence_requirements TABLE
-- ============================================================================
-- Specifies what types of evidence (images, videos, documents) are required
-- for a task, optionally defined by manager

CREATE TABLE IF NOT EXISTS public.task_evidence_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  evidence_type VARCHAR(50) NOT NULL,  -- 'image', 'video', 'file', 'any'
  description TEXT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  max_files INT NULL,                   -- null = unlimited
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT task_evidence_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT task_evidence_requirements_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  CONSTRAINT task_evidence_requirements_evidence_type_check CHECK (
    evidence_type::text = ANY (
      ARRAY['image'::text, 'video'::text, 'file'::text, 'any'::text]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_task_evidence_requirements_task_id 
  ON public.task_evidence_requirements USING btree (task_id);

-- ============================================================================
-- 3. CREATE task_reports TABLE
-- ============================================================================
-- Main report submitted by service provider for an in-progress/completed task
-- One report per task per provider

CREATE TABLE IF NOT EXISTS public.task_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  -- Status: 'in_progress', 'submitted', 'approved', 'rejected'
  
  -- Progress tracking
  progress_percentage INT NOT NULL DEFAULT 0,
  summary TEXT NULL,
  
  -- Approval workflow
  submitted_at TIMESTAMP WITH TIME ZONE NULL,
  submitted_notes TEXT NULL,
  approved_at TIMESTAMP WITH TIME ZONE NULL,
  approved_by UUID NULL,              -- Manager who approved
  approval_notes TEXT NULL,
  rejected_at TIMESTAMP WITH TIME ZONE NULL,
  rejected_by UUID NULL,              -- Manager who rejected
  rejection_reason TEXT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT task_reports_pkey PRIMARY KEY (id),
  CONSTRAINT task_reports_unique UNIQUE (task_id, provider_id),
  CONSTRAINT task_reports_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  CONSTRAINT task_reports_provider_id_fkey 
    FOREIGN KEY (provider_id) REFERENCES user_profiles (id) ON DELETE CASCADE,
  CONSTRAINT task_reports_approved_by_fkey 
    FOREIGN KEY (approved_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT task_reports_rejected_by_fkey 
    FOREIGN KEY (rejected_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT task_reports_status_check CHECK (
    status::text = ANY (
      ARRAY['in_progress'::text, 'submitted'::text, 'approved'::text, 'rejected'::text]::text[]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_task_reports_task_id 
  ON public.task_reports USING btree (task_id);

CREATE INDEX IF NOT EXISTS idx_task_reports_provider_id 
  ON public.task_reports USING btree (provider_id);

CREATE INDEX IF NOT EXISTS idx_task_reports_status 
  ON public.task_reports USING btree (status);

CREATE TRIGGER update_task_reports_updated_at BEFORE
UPDATE ON task_reports FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

-- ============================================================================
-- 4. CREATE report_checklist_items TABLE
-- ============================================================================
-- Tracks which checklist items have been checked by service provider

CREATE TABLE IF NOT EXISTS public.report_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  checklist_item_id UUID NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMP WITH TIME ZONE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT report_checklist_items_pkey PRIMARY KEY (id),
  CONSTRAINT report_checklist_items_unique UNIQUE (report_id, checklist_item_id),
  CONSTRAINT report_checklist_items_report_id_fkey 
    FOREIGN KEY (report_id) REFERENCES task_reports (id) ON DELETE CASCADE,
  CONSTRAINT report_checklist_items_checklist_item_id_fkey 
    FOREIGN KEY (checklist_item_id) REFERENCES task_checklists (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_checklist_items_report_id 
  ON public.report_checklist_items USING btree (report_id);

CREATE INDEX IF NOT EXISTS idx_report_checklist_items_checked 
  ON public.report_checklist_items USING btree (is_checked);

CREATE TRIGGER update_report_checklist_items_updated_at BEFORE
UPDATE ON report_checklist_items FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

-- ============================================================================
-- 5. CREATE report_evidence TABLE
-- ============================================================================
-- Stores evidence (photos/videos) uploaded by service provider with task report

CREATE TABLE IF NOT EXISTS public.report_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  attachment_id UUID NOT NULL,
  evidence_type VARCHAR(50) NOT NULL,  -- 'image', 'video', 'file'
  description TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT report_evidence_pkey PRIMARY KEY (id),
  CONSTRAINT report_evidence_unique UNIQUE (report_id, attachment_id),
  CONSTRAINT report_evidence_report_id_fkey 
    FOREIGN KEY (report_id) REFERENCES task_reports (id) ON DELETE CASCADE,
  CONSTRAINT report_evidence_attachment_id_fkey 
    FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE CASCADE,
  CONSTRAINT report_evidence_evidence_type_check CHECK (
    evidence_type::text = ANY (
      ARRAY['image'::text, 'video'::text, 'file'::text]::text[]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_report_evidence_report_id 
  ON public.report_evidence USING btree (report_id);

CREATE INDEX IF NOT EXISTS idx_report_evidence_evidence_type 
  ON public.report_evidence USING btree (evidence_type);

-- ============================================================================
-- 6. CREATE task_issues TABLE
-- ============================================================================
-- Issues/challenges raised by service provider during task execution

CREATE TABLE IF NOT EXISTS public.task_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(50) NOT NULL DEFAULT 'medium',
  -- Severity: 'low', 'medium', 'high', 'critical'
  
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  -- Status: 'open', 'acknowledged', 'in_resolution', 'resolved'
  
  created_by UUID NOT NULL,           -- Service provider
  assigned_to UUID NULL,              -- Manager assigned to resolve
  resolved_at TIMESTAMP WITH TIME ZONE NULL,
  resolution_notes TEXT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT task_issues_pkey PRIMARY KEY (id),
  CONSTRAINT task_issues_report_id_fkey 
    FOREIGN KEY (report_id) REFERENCES task_reports (id) ON DELETE CASCADE,
  CONSTRAINT task_issues_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT task_issues_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT task_issues_severity_check CHECK (
    severity::text = ANY (
      ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]::text[]
    )
  ),
  CONSTRAINT task_issues_status_check CHECK (
    status::text = ANY (
      ARRAY['open'::text, 'acknowledged'::text, 'in_resolution'::text, 'resolved'::text]::text[]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_task_issues_report_id 
  ON public.task_issues USING btree (report_id);

CREATE INDEX IF NOT EXISTS idx_task_issues_status 
  ON public.task_issues USING btree (status);

CREATE INDEX IF NOT EXISTS idx_task_issues_severity 
  ON public.task_issues USING btree (severity);

CREATE INDEX IF NOT EXISTS idx_task_issues_created_by 
  ON public.task_issues USING btree (created_by);

CREATE TRIGGER update_task_issues_updated_at BEFORE
UPDATE ON task_issues FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

-- ============================================================================
-- 7. CREATE report_activity_log TABLE
-- ============================================================================
-- Detailed audit trail of all actions taken on a report

CREATE TABLE IF NOT EXISTS public.report_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  -- Actions: 'created', 'updated', 'checklist_checked', 'evidence_added',
  --          'issue_raised', 'submitted', 'approved', 'rejected',
  --          'issue_resolved'
  
  actor_id UUID NOT NULL,             -- User who performed action
  actor_role VARCHAR(50) NOT NULL,    -- 'service_provider' or 'manager'
  details JSONB NULL,                 -- Additional context (e.g., which checklist item)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT report_activity_log_pkey PRIMARY KEY (id),
  CONSTRAINT report_activity_log_report_id_fkey 
    FOREIGN KEY (report_id) REFERENCES task_reports (id) ON DELETE CASCADE,
  CONSTRAINT report_activity_log_actor_id_fkey 
    FOREIGN KEY (actor_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_activity_log_report_id 
  ON public.report_activity_log USING btree (report_id);

CREATE INDEX IF NOT EXISTS idx_report_activity_log_created_at 
  ON public.report_activity_log USING btree (created_at DESC);

-- ============================================================================
-- 8. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_evidence_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. RLS POLICIES - task_reports
-- ============================================================================

-- Service provider can view their own reports
CREATE POLICY task_reports_select_provider
  ON public.task_reports FOR SELECT
  USING (
    provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Service provider can create reports for assigned tasks
CREATE POLICY task_reports_insert_provider
  ON public.task_reports FOR INSERT
  WITH CHECK (
    provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
      AND t.assigned_to = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
      AND t.status = 'in_progress'
    )
  );

-- Service provider can update their own reports
CREATE POLICY task_reports_update_provider
  ON public.task_reports FOR UPDATE
  USING (
    provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Manager can view reports for tasks they created
CREATE POLICY task_reports_select_manager
  ON public.task_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
      AND t.created_by = auth.uid()
    )
  );

-- Manager can approve/reject reports
CREATE POLICY task_reports_update_manager
  ON public.task_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
      AND t.created_by = auth.uid()
    )
  );

-- ============================================================================
-- 10. RLS POLICIES - report_checklist_items
-- ============================================================================

CREATE POLICY report_checklist_items_select
  ON public.report_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_reports tr
      WHERE tr.id = report_id
      AND (
        tr.provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.id = tr.task_id
          AND t.created_by = auth.uid()
        )
      )
    )
  );

CREATE POLICY report_checklist_items_insert
  ON public.report_checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_reports tr
      WHERE tr.id = report_id
      AND tr.provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY report_checklist_items_update
  ON public.report_checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM task_reports tr
      WHERE tr.id = report_id
      AND tr.provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

-- ============================================================================
-- 11. RLS POLICIES - report_evidence
-- ============================================================================

CREATE POLICY report_evidence_select
  ON public.report_evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_reports tr
      WHERE tr.id = report_id
      AND (
        tr.provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.id = tr.task_id
          AND t.created_by = auth.uid()
        )
      )
    )
  );

CREATE POLICY report_evidence_insert
  ON public.report_evidence FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_reports tr
      WHERE tr.id = report_id
      AND tr.provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

-- ============================================================================
-- 12. RLS POLICIES - task_issues
-- ============================================================================

CREATE POLICY task_issues_select
  ON public.task_issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_reports tr
      WHERE tr.id = report_id
      AND (
        tr.provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.id = tr.task_id
          AND t.created_by = auth.uid()
        )
      )
    )
  );

CREATE POLICY task_issues_insert
  ON public.task_issues FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM task_reports tr
      WHERE tr.id = report_id
      AND tr.provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY task_issues_update_provider
  ON public.task_issues FOR UPDATE
  USING (
    created_by = auth.uid()
  );

CREATE POLICY task_issues_update_manager
  ON public.task_issues FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_reports tr, tasks t
      WHERE tr.id = report_id
      AND t.id = tr.task_id
      AND t.created_by = auth.uid()
    )
  );

-- ============================================================================
-- 13. RLS POLICIES - report_activity_log (for audit trail)
-- ============================================================================

CREATE POLICY report_activity_log_select
  ON public.report_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_reports tr
      WHERE tr.id = report_id
      AND (
        tr.provider_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.id = tr.task_id
          AND t.created_by = auth.uid()
        )
      )
    )
  );

CREATE POLICY report_activity_log_insert
  ON public.report_activity_log FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
  );

-- ============================================================================
-- 14. SAMPLE DATA - Test Scenario
-- ============================================================================
-- This inserts test data to demonstrate a complete workflow:
-- - Manager creates task with checklist and evidence requirements
-- - Service provider works on task and submits report
-- - Manager reviews and approves

-- Note: Replace UUIDs with actual values from your database

-- For testing, you'll need to:
-- 1. Create test users via auth
-- 2. Insert test profiles
-- 3. Create test tasks
-- 4. Then insert sample data below

-- Example (commented out - uncomment and adjust UUIDs):
/*

-- Assume you have:
-- - manager_user_id: UUID of authenticated manager
-- - provider_user_id: UUID of authenticated service provider
-- - manager_profile_id: UUID from user_profiles for manager
-- - provider_profile_id: UUID from user_profiles for provider

-- 1. Insert sample task (created by manager)
INSERT INTO tasks (
  title, description, priority, status, category,
  assigned_to, assignee_name, assigned_category,
  due_date, estimated_time, payment_terms,
  created_by, budget, is_from_complaint
) VALUES (
  'Repair Bathroom Sink - Room 305',
  'Fix the leaky faucet in the master bathroom. The water is dripping constantly from the faucet handle.',
  'high',
  'in_progress',  -- Manager sets this after acceptance
  'maintenance',
  provider_profile_id,
  'John Plumber',
  'external',
  CURRENT_DATE + INTERVAL '3 days',
  '2-3 hours',
  'Flat rate $150',
  manager_user_id,
  150.00,
  false
) RETURNING id AS task_id;

-- Store the returned task_id for use below

-- 2. Insert checklist items for the task
INSERT INTO task_checklists (task_id, title, description, order_index, is_optional) VALUES
  (task_id, 'Inspect faucet and identify issue', 'Check valve, seals, and connection points', 1, false),
  (task_id, 'Replace washers/seals as needed', 'Install new rubber washers and seals', 2, false),
  (task_id, 'Test water flow and check for leaks', 'Ensure faucet works properly and no leaks remain', 3, false),
  (task_id, 'Clean up work area', 'Return bathroom to original condition', 4, true);

-- 3. Insert evidence requirements for the task
INSERT INTO task_evidence_requirements (task_id, evidence_type, description, is_required, max_files) VALUES
  (task_id, 'image', 'Before and after photos of the sink', true, 4),
  (task_id, 'video', 'Video of faucet working properly (optional)', false, 1);

-- 4. Create task report when service provider starts working
INSERT INTO task_reports (task_id, provider_id, status, progress_percentage, summary)
VALUES (task_id, provider_profile_id, 'in_progress', 0, NULL)
RETURNING id AS report_id;

-- 5. Add activity log entry
INSERT INTO report_activity_log (report_id, action, actor_id, actor_role)
VALUES (report_id, 'created', provider_user_id, 'service_provider');

-- [Later in workflow: Service provider checks off items]

-- 6. Service provider checks first checklist item
UPDATE report_checklist_items
SET is_checked = true, checked_at = now(), notes = 'Found worn rubber washer causing leak'
WHERE report_id = report_id AND checklist_item_id = (
  SELECT id FROM task_checklists WHERE task_id = task_id AND title = 'Inspect faucet and identify issue'
);

INSERT INTO report_activity_log (report_id, action, actor_id, actor_role, details)
VALUES (report_id, 'checklist_checked', provider_user_id, 'service_provider',
  jsonb_build_object('checklist_item', 'Inspect faucet and identify issue'));

-- 7. Service provider checks second item
UPDATE report_checklist_items
SET is_checked = true, checked_at = now(), notes = 'Installed new rubber washers'
WHERE report_id = report_id AND checklist_item_id = (
  SELECT id FROM task_checklists WHERE task_id = task_id AND title = 'Replace washers/seals as needed'
);

INSERT INTO report_activity_log (report_id, action, actor_id, actor_role, details)
VALUES (report_id, 'checklist_checked', provider_user_id, 'service_provider',
  jsonb_build_object('checklist_item', 'Replace washers/seals as needed'));

-- [Service provider uploads evidence photos]
-- Assume attachments with IDs: photo1_id, photo2_id

-- 8. Service provider submits report
UPDATE task_reports
SET status = 'submitted', progress_percentage = 100, submitted_at = now(),
    submitted_notes = 'Replaced worn washers and seals. Faucet now works perfectly. All items checked.'
WHERE id = report_id;

INSERT INTO report_activity_log (report_id, action, actor_id, actor_role)
VALUES (report_id, 'submitted', provider_user_id, 'service_provider');

-- [Manager reviews in Reports tab]

-- 9. Manager approves the report
UPDATE task_reports
SET status = 'approved', approved_at = now(), approved_by = manager_user_id,
    approval_notes = 'Excellent work. All checklist items completed and evidence provided. Task marked as complete.'
WHERE id = report_id;

-- 10. Update task status to completed (triggered by report approval)
UPDATE tasks SET status = 'completed', updated_at = now() WHERE id = task_id;

-- 11. Create completion activity log
INSERT INTO report_activity_log (report_id, action, actor_id, actor_role)
VALUES (report_id, 'approved', manager_user_id, 'manager');

-- [Optional: Service provider raises issue during work]

-- 12. Service provider encounters issue
INSERT INTO task_issues (report_id, title, description, severity, status, created_by)
VALUES (report_id, 'Faucet valve stuck', 
  'The valve is stuck and I cannot fully close it. May need parts replacement.',
  'high', 'open', provider_user_id);

INSERT INTO report_activity_log (report_id, action, actor_id, actor_role, details)
VALUES (report_id, 'issue_raised', provider_user_id, 'service_provider',
  jsonb_build_object('issue', 'Faucet valve stuck', 'severity', 'high'));

-- 13. Manager acknowledges issue
UPDATE task_issues
SET status = 'acknowledged', assigned_to = manager_user_id
WHERE title = 'Faucet valve stuck' AND report_id = report_id;

-- 14. Manager resolves issue (authorizes parts replacement)
UPDATE task_issues
SET status = 'resolved', resolved_at = now(),
    resolution_notes = 'Approved replacement valve. Cost: $45 (within budget adjustment of +$20). Continue with task.'
WHERE title = 'Faucet valve stuck' AND report_id = report_id;

*/

-- ============================================================================
-- 15. VIEWS FOR CONVENIENT QUERIES
-- ============================================================================

-- View: Service provider's active reports with progress
CREATE OR REPLACE VIEW public.provider_active_reports AS
SELECT
  tr.id AS report_id,
  tr.task_id,
  t.title,
  t.priority,
  t.due_date,
  tr.provider_id,
  tr.status,
  tr.progress_percentage,
  COUNT(DISTINCT rci.id) FILTER (WHERE rci.is_checked) AS checklist_items_completed,
  COUNT(DISTINCT rci.id) AS total_checklist_items,
  COUNT(DISTINCT ti.id) FILTER (WHERE ti.status IN ('open', 'acknowledged', 'in_resolution')) AS open_issues,
  COUNT(DISTINCT re.id) AS evidence_count,
  tr.submitted_at,
  tr.approved_at
FROM task_reports tr
JOIN tasks t ON t.id = tr.task_id
LEFT JOIN report_checklist_items rci ON rci.report_id = tr.id
LEFT JOIN task_issues ti ON ti.report_id = tr.id
LEFT JOIN report_evidence re ON re.report_id = tr.id
WHERE tr.status IN ('in_progress', 'submitted')
GROUP BY tr.id, tr.task_id, t.title, t.priority, t.due_date,
  tr.provider_id, tr.status, tr.progress_percentage, tr.submitted_at, tr.approved_at;

-- View: Manager's report reviews with flagged issues
CREATE OR REPLACE VIEW public.manager_pending_reports AS
SELECT
  tr.id AS report_id,
  tr.task_id,
  t.title,
  t.priority,
  t.due_date,
  up.first_name || ' ' || up.last_name AS provider_name,
  tr.status,
  tr.progress_percentage,
  COUNT(DISTINCT ti.id) FILTER (WHERE ti.status IN ('open', 'acknowledged', 'in_resolution')) AS open_issues,
  COUNT(DISTINCT re.id) AS evidence_count,
  MAX(ral.created_at) AS last_activity
FROM task_reports tr
JOIN tasks t ON t.id = tr.task_id
JOIN user_profiles up ON up.id = tr.provider_id
LEFT JOIN task_issues ti ON ti.report_id = tr.id
LEFT JOIN report_evidence re ON re.report_id = tr.id
LEFT JOIN report_activity_log ral ON ral.report_id = tr.id
WHERE tr.status IN ('submitted')
  AND t.created_by = auth.uid()
GROUP BY tr.id, tr.task_id, t.title, t.priority, t.due_date, up.first_name, up.last_name,
  tr.status, tr.progress_percentage;

-- ============================================================================
-- 16. HELPER FUNCTION: Auto-create report when task status changes to in_progress
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_report_on_task_in_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- When task status changes to 'in_progress', create a task report for assigned provider
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') THEN
    IF NEW.assigned_to IS NOT NULL THEN
      -- Create report if not already exists
      INSERT INTO public.task_reports (task_id, provider_id, status, progress_percentage)
      VALUES (NEW.id, NEW.assigned_to, 'in_progress', 0)
      ON CONFLICT (task_id, provider_id) DO NOTHING;

      -- Create initial activity log
      INSERT INTO public.report_activity_log (report_id, action, actor_id, actor_role)
      SELECT tr.id, 'created', NEW.created_by, 'manager'
      FROM task_reports tr
      WHERE tr.task_id = NEW.id AND tr.provider_id = NEW.assigned_to;

      -- Notify service provider
      INSERT INTO public.notifications (user_id, task_id, type, message)
      SELECT up.user_id, NEW.id, 'task_assigned', 
        'Task "' || NEW.title || '" is now in progress. Please start reporting your progress.'
      FROM user_profiles up
      WHERE up.id = NEW.assigned_to;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger if it exists
DROP TRIGGER IF EXISTS on_task_in_progress_create_report ON public.tasks;

CREATE TRIGGER on_task_in_progress_create_report
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
WHEN (NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress'))
EXECUTE FUNCTION public.create_report_on_task_in_progress();

-- ============================================================================
-- 17. HELPER FUNCTION: Update task status when report is approved
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_task_on_report_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When report is approved, update task status to 'completed'
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE public.tasks
    SET status = 'completed', updated_at = now()
    WHERE id = NEW.task_id;

    -- Notify service provider of approval
    INSERT INTO public.notifications (user_id, task_id, type, message)
    SELECT up.user_id, NEW.task_id, 'task_completed',
      'Your task report has been approved! Task marked as completed.'
    FROM user_profiles up
    WHERE up.id = NEW.provider_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_report_approved_complete_task ON public.task_reports;

CREATE TRIGGER on_report_approved_complete_task
AFTER UPDATE OF status ON public.task_reports
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
EXECUTE FUNCTION public.complete_task_on_report_approval();

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================
-- ✅ Tables created:
--    1. task_checklists - Checklist items for tasks
--    2. task_evidence_requirements - Required evidence types
--    3. task_reports - Main service provider reports
--    4. report_checklist_items - Checklist progress tracking
--    5. report_evidence - Evidence/proof uploads
--    6. task_issues - Issues/challenges raised
--    7. report_activity_log - Detailed audit trail
--
-- ✅ Views created:
--    - provider_active_reports - Service provider view of their reports
--    - manager_pending_reports - Manager view of reports needing approval
--
-- ✅ Functions created:
--    - create_report_on_task_in_progress() - Auto-create report on status change
--    - complete_task_on_report_approval() - Auto-complete task on approval
--
-- ✅ RLS Policies applied:
--    - Service providers can only access their own reports
--    - Managers can only access reports for tasks they created
--    - Proper read/write access for all user roles
--
-- ✅ Indexes created for:
--    - Common query patterns (task_id, provider_id, status)
--    - Sorting by created_at and activity
--
-- ⚠️  IMPORTANT REMINDERS:
--    - RLS is enabled on all new tables
--    - Verify sample data UUIDs match your actual database before running
--    - Triggers automatically create reports and complete tasks
--    - Activity log provides full audit trail for compliance
--
-- ============================================================================
