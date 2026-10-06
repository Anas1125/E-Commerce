--
-- PostgreSQL database dump
--

\restrict 6xpNfdGD3sy6GtXehMDuPiKQw4apdjgRMfGBVmEAb7Q5qPIHuf3UzAo3ddcCTz4

-- Dumped from database version 17.11 (Homebrew)
-- Dumped by pg_dump version 17.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: site_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site_settings (id, navbar_logo_url, hero_image_url, footer_logo_url, favicon_url, site_name) FROM stdin;
1	http://localhost:8000/uploads/branding/e298864fdb8b4a91af2088d713157a1b.png	http://localhost:8000/uploads/branding/ac9e10d115834d9197e34edd7a771447.png	http://localhost:8000/uploads/branding/795973675de14dbab05733e13897381e.png	http://localhost:8000/uploads/branding/8b51fc157a184a42864ec3bfa43ed746.png	TerraLens
\.


--
-- Name: site_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.site_settings_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict 6xpNfdGD3sy6GtXehMDuPiKQw4apdjgRMfGBVmEAb7Q5qPIHuf3UzAo3ddcCTz4

