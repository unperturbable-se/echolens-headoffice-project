CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO branches (code, name_en, name_ur, city, address_en, address_ur) VALUES
('KHI-01', 'Karachi Central', 'کراچی مرکزی', 'Karachi', 'Main Shahrah-e-Faisal', 'مین شاہراہ فیصل'),
('LHE-01', 'Lahore Main', 'لاہور مین', 'Lahore', 'Mall Road', 'مال روڈ'),
('ISB-01', 'Islamabad Hub', 'اسلام آباد حب', 'Islamabad', 'Blue Area', 'بلیو ایریا')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (branch_id, full_name, email, password_hash, role) VALUES
(NULL, 'Super Admin', 'admin@echolens.test', crypt('Test@1234', gen_salt('bf')), 'SUPER_ADMIN'),
(NULL, 'Fatima Finance', 'finance@echolens.test', crypt('Test@1234', gen_salt('bf')), 'FINANCE_REVIEWER'),
(NULL, 'Ehsan Editor', 'editor@echolens.test', crypt('Test@1234', gen_salt('bf')), 'CONTENT_EDITOR'),
((SELECT id FROM branches WHERE code = 'KHI-01'), 'Ali Khan', 'ali.khi@echolens.test', crypt('Test@1234', gen_salt('bf')), 'BRANCH_LEAD'),
((SELECT id FROM branches WHERE code = 'LHE-01'), 'Sara Ahmed', 'sara.lhe@echolens.test', crypt('Test@1234', gen_salt('bf')), 'BRANCH_LEAD'),
((SELECT id FROM branches WHERE code = 'ISB-01'), 'Usman Raza', 'usman.isb@echolens.test', crypt('Test@1234', gen_salt('bf')), 'BRANCH_LEAD'),
(NULL, 'Hina HR', 'hr@echolens.test', crypt('Test@1234', gen_salt('bf')), 'HR_LEAD')
ON CONFLICT (email) DO NOTHING;

INSERT INTO collection_records (branch_id, submitted_by, reviewed_by, title_en, title_ur, amount, collection_date, status, review_notes, reviewed_at) VALUES
((SELECT id FROM branches WHERE code = 'KHI-01'), (SELECT id FROM users WHERE email = 'ali.khi@echolens.test'), NULL, 'October Membership Fees', 'اکتوبر ممبرشپ فیس', 125000.00, '2026-10-20', 'PENDING', NULL, NULL),
((SELECT id FROM branches WHERE code = 'KHI-01'), (SELECT id FROM users WHERE email = 'ali.khi@echolens.test'), (SELECT id FROM users WHERE email = 'finance@echolens.test'), 'September Donations', 'ستمبر عطیات', 80000.00, '2026-09-28', 'APPROVED', 'Verified against bank slip', now() - interval '20 days'),
((SELECT id FROM branches WHERE code = 'LHE-01'), (SELECT id FROM users WHERE email = 'sara.lhe@echolens.test'), (SELECT id FROM users WHERE email = 'finance@echolens.test'), 'Event Collection', 'تقریب وصولی', 45000.50, '2026-10-05', 'REJECTED', 'Receipts missing', now() - interval '10 days'),
((SELECT id FROM branches WHERE code = 'LHE-01'), (SELECT id FROM users WHERE email = 'sara.lhe@echolens.test'), NULL, 'October Membership Fees', 'اکتوبر ممبرشپ فیس', 98000.00, '2026-10-22', 'PENDING', NULL, NULL),
((SELECT id FROM branches WHERE code = 'ISB-01'), (SELECT id FROM users WHERE email = 'usman.isb@echolens.test'), (SELECT id FROM users WHERE email = 'finance@echolens.test'), 'Fundraiser', 'فنڈ ریزر', 210000.00, '2026-10-12', 'APPROVED', 'Approved', now() - interval '5 days');

INSERT INTO weekly_reports (branch_id, submitted_by, week_start_date, week_end_date, summary_en, summary_ur, total_members_active, new_registrations) VALUES
((SELECT id FROM branches WHERE code = 'KHI-01'), (SELECT id FROM users WHERE email = 'ali.khi@echolens.test'), '2026-10-12', '2026-10-18', 'Steady week with two outreach sessions.', 'دو آؤٹ ریچ سیشنز کے ساتھ مستحکم ہفتہ۔', 142, 6),
((SELECT id FROM branches WHERE code = 'KHI-01'), (SELECT id FROM users WHERE email = 'ali.khi@echolens.test'), '2026-10-19', '2026-10-25', 'Membership drive launched.', 'ممبرشپ مہم کا آغاز۔', 148, 9),
((SELECT id FROM branches WHERE code = 'LHE-01'), (SELECT id FROM users WHERE email = 'sara.lhe@echolens.test'), '2026-10-19', '2026-10-25', 'Workshop held on Saturday.', 'ہفتے کو ورکشاپ ہوئی۔', 97, 4),
((SELECT id FROM branches WHERE code = 'ISB-01'), (SELECT id FROM users WHERE email = 'usman.isb@echolens.test'), '2026-10-19', '2026-10-25', 'Fundraiser follow-ups completed.', 'فنڈ ریزر کے فالو اپس مکمل۔', 76, 3);

INSERT INTO members (branch_id, full_name_en, full_name_ur, cnic_or_id, phone, is_active, joined_date) VALUES
((SELECT id FROM branches WHERE code = 'KHI-01'), 'Bilal Hussain', 'بلال حسین', '42101-1111111-1', '0300-1111111', TRUE, '2025-03-10'),
((SELECT id FROM branches WHERE code = 'KHI-01'), 'Ayesha Malik', 'عائشہ ملک', '42101-2222222-2', '0301-2222222', TRUE, '2025-06-21'),
((SELECT id FROM branches WHERE code = 'LHE-01'), 'Hamza Sheikh', 'حمزہ شیخ', '35202-3333333-3', '0302-3333333', TRUE, '2025-08-02'),
((SELECT id FROM branches WHERE code = 'LHE-01'), 'Zainab Iqbal', 'زینب اقبال', '35202-4444444-4', '0303-4444444', FALSE, '2024-11-15'),
((SELECT id FROM branches WHERE code = 'ISB-01'), 'Omar Farooq', 'عمر فاروق', '61101-5555555-5', '0304-5555555', TRUE, '2026-01-09');

INSERT INTO public_notices (created_by, title_en, title_ur, content_en, content_ur, is_published, published_at) VALUES
((SELECT id FROM users WHERE email = 'editor@echolens.test'), 'Annual Meeting', 'سالانہ اجلاس', 'The annual meeting will be held next month.', 'سالانہ اجلاس اگلے ماہ منعقد ہوگا۔', TRUE, now() - interval '3 days'),
((SELECT id FROM users WHERE email = 'editor@echolens.test'), 'Holiday Schedule', 'تعطیلات کا شیڈول', 'Offices will be closed on public holidays.', 'سرکاری تعطیلات پر دفاتر بند رہیں گے۔', FALSE, NULL);

INSERT INTO public_inquiries (sender_name, sender_email, subject, message, is_resolved) VALUES
('Kamran Ali', 'kamran@example.com', 'Membership', 'How can I join a branch?', FALSE),
('Nida Tariq', 'nida@example.com', 'Donation', 'Where can I donate?', TRUE);

INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES
((SELECT id FROM users WHERE email = 'finance@echolens.test'), 'COLLECTION_APPROVED', 'collection_records', (SELECT id FROM collection_records WHERE title_en = 'Fundraiser'), '{}'::jsonb),
((SELECT id FROM users WHERE email = 'finance@echolens.test'), 'COLLECTION_REJECTED', 'collection_records', (SELECT id FROM collection_records WHERE title_en = 'Event Collection'), '{}'::jsonb);