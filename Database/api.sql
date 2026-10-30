CREATE OR REPLACE FUNCTION private.actor(p_id UUID, p_roles public.user_role[])
RETURNS public.users LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users;
BEGIN
    SELECT * INTO u FROM public.users WHERE id = p_id AND is_active;
    IF NOT FOUND OR NOT (u.role = ANY(p_roles)) THEN RAISE EXCEPTION 'forbidden'; END IF;
    RETURN u;
END $$;

CREATE OR REPLACE FUNCTION private.audit(p_user UUID, p_action TEXT, p_resource TEXT, p_id UUID, p_details JSONB DEFAULT NULL)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    INSERT INTO public.audit_logs(user_id, action, resource, resource_id, details)
    VALUES (p_user, p_action, p_resource, p_id, p_details);
$$;

CREATE OR REPLACE FUNCTION api.get_login(p_email public.citext)
RETURNS TABLE(id UUID, password_hash VARCHAR, role public.user_role, branch_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT u.id, u.password_hash, u.role, u.branch_id FROM public.users u WHERE u.email = p_email AND u.is_active;
$$;

CREATE OR REPLACE FUNCTION api.create_session(p_user UUID, p_hash CHAR(64), p_ip INET, p_ua TEXT, p_exp TIMESTAMPTZ)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    UPDATE public.users SET last_login_at = now() WHERE id = p_user;
    INSERT INTO public.user_sessions(user_id, token_hash, ip_address, user_agent, expires_at)
    VALUES (p_user, p_hash, p_ip, p_ua, p_exp);
$$;

CREATE OR REPLACE FUNCTION api.validate_session(p_hash CHAR(64))
RETURNS TABLE(user_id UUID, role public.user_role, branch_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT u.id, u.role, u.branch_id FROM public.user_sessions s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.token_hash = p_hash AND s.expires_at > now() AND u.is_active;
$$;

CREATE OR REPLACE FUNCTION api.delete_session(p_hash CHAR(64))
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    DELETE FROM public.user_sessions WHERE token_hash = p_hash;
$$;

CREATE OR REPLACE FUNCTION api.create_branch(p_actor UUID, p_code TEXT, p_name_en TEXT, p_name_ur TEXT, p_city TEXT, p_addr_en TEXT, p_addr_ur TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v UUID;
BEGIN
    PERFORM private.actor(p_actor, ARRAY['SUPER_ADMIN']::public.user_role[]);
    INSERT INTO public.branches(code, name_en, name_ur, city, address_en, address_ur)
    VALUES (p_code, p_name_en, p_name_ur, p_city, p_addr_en, p_addr_ur) RETURNING id INTO v;
    PERFORM private.audit(p_actor, 'BRANCH_CREATED', 'branches', v);
    RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.create_user(p_actor UUID, p_branch UUID, p_name TEXT, p_email public.citext, p_hash TEXT, p_role public.user_role)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v UUID;
BEGIN
    PERFORM private.actor(p_actor, ARRAY['SUPER_ADMIN']::public.user_role[]);
    INSERT INTO public.users(branch_id, full_name, email, password_hash, role)
    VALUES (p_branch, p_name, p_email, p_hash, p_role) RETURNING id INTO v;
    PERFORM private.audit(p_actor, 'USER_CREATED', 'users', v, jsonb_build_object('role', p_role));
    RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.set_user_active(p_actor UUID, p_id UUID, p_active BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.actor(p_actor, ARRAY['SUPER_ADMIN']::public.user_role[]);
    UPDATE public.users SET is_active = p_active WHERE id = p_id;
    IF NOT p_active THEN DELETE FROM public.user_sessions WHERE user_id = p_id; END IF;
    PERFORM private.audit(p_actor, 'USER_ACTIVE_CHANGED', 'users', p_id, jsonb_build_object('active', p_active));
END $$;

CREATE OR REPLACE FUNCTION api.submit_collection(p_actor UUID, p_title_en TEXT, p_title_ur TEXT, p_amount NUMERIC, p_date DATE)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users; v UUID;
BEGIN
    u := private.actor(p_actor, ARRAY['BRANCH_LEAD']::public.user_role[]);
    INSERT INTO public.collection_records(branch_id, submitted_by, title_en, title_ur, amount, collection_date)
    VALUES (u.branch_id, p_actor, p_title_en, p_title_ur, p_amount, p_date) RETURNING id INTO v;
    PERFORM private.audit(p_actor, 'COLLECTION_SUBMITTED', 'collection_records', v, jsonb_build_object('amount', p_amount));
    RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.review_collection(p_actor UUID, p_id UUID, p_approve BOOLEAN, p_notes TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.actor(p_actor, ARRAY['FINANCE_REVIEWER','SUPER_ADMIN']::public.user_role[]);
    UPDATE public.collection_records
    SET status = (CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END)::public.approval_status,
        reviewed_by = p_actor, reviewed_at = now(), review_notes = p_notes
    WHERE id = p_id AND status = 'PENDING';
    IF NOT FOUND THEN RAISE EXCEPTION 'not pending'; END IF;
    PERFORM private.audit(p_actor, CASE WHEN p_approve THEN 'COLLECTION_APPROVED' ELSE 'COLLECTION_REJECTED' END, 'collection_records', p_id);
END $$;

CREATE OR REPLACE FUNCTION api.submit_weekly_report(p_actor UUID, p_start DATE, p_end DATE, p_en TEXT, p_ur TEXT, p_active INT, p_new INT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users; v UUID;
BEGIN
    u := private.actor(p_actor, ARRAY['BRANCH_LEAD']::public.user_role[]);
    INSERT INTO public.weekly_reports(branch_id, submitted_by, week_start_date, week_end_date, summary_en, summary_ur, total_members_active, new_registrations)
    VALUES (u.branch_id, p_actor, p_start, p_end, p_en, p_ur, p_active, p_new) RETURNING id INTO v;
    PERFORM private.audit(p_actor, 'REPORT_SUBMITTED', 'weekly_reports', v);
    RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.add_member(p_actor UUID, p_branch UUID, p_name_en TEXT, p_name_ur TEXT, p_cnic TEXT, p_phone TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users; v UUID;
BEGIN
    u := private.actor(p_actor, ARRAY['BRANCH_LEAD','HR_LEAD']::public.user_role[]);
    INSERT INTO public.members(branch_id, full_name_en, full_name_ur, cnic_or_id, phone)
    VALUES (COALESCE(u.branch_id, p_branch), p_name_en, p_name_ur, p_cnic, p_phone) RETURNING id INTO v;
    PERFORM private.audit(p_actor, 'MEMBER_ADDED', 'members', v);
    RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.set_member_active(p_actor UUID, p_id UUID, p_active BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users;
BEGIN
    u := private.actor(p_actor, ARRAY['BRANCH_LEAD','HR_LEAD']::public.user_role[]);
    UPDATE public.members SET is_active = p_active WHERE id = p_id AND (u.branch_id IS NULL OR branch_id = u.branch_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
    PERFORM private.audit(p_actor, 'MEMBER_ACTIVE_CHANGED', 'members', p_id, jsonb_build_object('active', p_active));
END $$;

CREATE OR REPLACE FUNCTION api.save_notice(p_actor UUID, p_id UUID, p_title_en TEXT, p_title_ur TEXT, p_content_en TEXT, p_content_ur TEXT, p_publish BOOLEAN)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v UUID;
BEGIN
    PERFORM private.actor(p_actor, ARRAY['CONTENT_EDITOR','SUPER_ADMIN']::public.user_role[]);
    IF p_id IS NULL THEN
        INSERT INTO public.public_notices(created_by, title_en, title_ur, content_en, content_ur, is_published, published_at)
        VALUES (p_actor, p_title_en, p_title_ur, p_content_en, p_content_ur, p_publish, CASE WHEN p_publish THEN now() END)
        RETURNING id INTO v;
    ELSE
        UPDATE public.public_notices
        SET title_en = p_title_en, title_ur = p_title_ur, content_en = p_content_en, content_ur = p_content_ur,
            is_published = p_publish, published_at = CASE WHEN p_publish THEN COALESCE(published_at, now()) ELSE published_at END
        WHERE id = p_id RETURNING id INTO v;
        IF v IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
    END IF;
    PERFORM private.audit(p_actor, 'NOTICE_SAVED', 'public_notices', v, jsonb_build_object('published', p_publish));
    RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.submit_inquiry(p_name TEXT, p_email public.citext, p_subject TEXT, p_message TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    INSERT INTO public.public_inquiries(sender_name, sender_email, subject, message) VALUES (p_name, p_email, p_subject, p_message);
$$;

CREATE OR REPLACE FUNCTION api.resolve_inquiry(p_actor UUID, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM private.actor(p_actor, ARRAY['CONTENT_EDITOR','SUPER_ADMIN']::public.user_role[]);
    UPDATE public.public_inquiries SET is_resolved = TRUE WHERE id = p_id;
    PERFORM private.audit(p_actor, 'INQUIRY_RESOLVED', 'public_inquiries', p_id);
END $$;

CREATE OR REPLACE FUNCTION api.list_branches(p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users;
BEGIN
    u := private.actor(p_actor, enum_range(NULL::public.user_role));
    RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM public.branches x WHERE u.branch_id IS NULL OR x.id = u.branch_id), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION api.list_users(p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users;
BEGIN
    u := private.actor(p_actor, ARRAY['SUPER_ADMIN']::public.user_role[]);
    RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) - 'password_hash' ORDER BY x.created_at DESC) FROM public.users x), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION api.list_collections(p_actor UUID, p_status public.approval_status DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users;
BEGIN
    u := private.actor(p_actor, ARRAY['BRANCH_LEAD','FINANCE_REVIEWER','SUPER_ADMIN']::public.user_role[]);
    RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM public.collection_records x WHERE (u.branch_id IS NULL OR x.branch_id = u.branch_id) AND (p_status IS NULL OR x.status = p_status)), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION api.list_weekly_reports(p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users;
BEGIN
    u := private.actor(p_actor, ARRAY['BRANCH_LEAD','HR_LEAD','SUPER_ADMIN']::public.user_role[]);
    RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.week_start_date DESC) FROM public.weekly_reports x WHERE (u.branch_id IS NULL OR x.branch_id = u.branch_id)), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION api.list_members(p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users;
BEGIN
    u := private.actor(p_actor, ARRAY['BRANCH_LEAD','HR_LEAD','SUPER_ADMIN']::public.user_role[]);
    RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM public.members x WHERE (u.branch_id IS NULL OR x.branch_id = u.branch_id)), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION api.list_notices(p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users;
BEGIN
    u := private.actor(p_actor, ARRAY['CONTENT_EDITOR','SUPER_ADMIN']::public.user_role[]);
    RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM public.public_notices x), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION api.list_inquiries(p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users;
BEGIN
    u := private.actor(p_actor, ARRAY['CONTENT_EDITOR','SUPER_ADMIN']::public.user_role[]);
    RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM public.public_inquiries x), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION api.list_audit_logs(p_actor UUID, p_limit INT DEFAULT 100)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.users;
BEGIN
    u := private.actor(p_actor, ARRAY['SUPER_ADMIN']::public.user_role[]);
    RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT p_limit) x), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION api.list_published_notices()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY n.published_at DESC), '[]'::jsonb) FROM public.public_notices n WHERE n.is_published;
$$;

CREATE OR REPLACE FUNCTION private.purge_expired_sessions()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    DELETE FROM public.user_sessions WHERE expires_at < now();
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA api, private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO app_backend;