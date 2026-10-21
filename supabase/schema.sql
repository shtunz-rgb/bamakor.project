--
-- PostgreSQL database dump
--

\restrict glqBJlYzu5gTAqxMvHVevSQ1TSO3LHzXhYPeb1JoU98UuQt23kvcojypA4AjQe3

-- Dumped from database version 17.6
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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: record_game_open(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_game_open(p_uid text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin                                                                                                                                                                                                                                     
    insert into user_stats (uid, first_game_at, last_game_at, last_seen_at)                                                                                                                                                               
    values (p_uid, now(), now(), now())
    on conflict (uid) do update set
      first_game_at = coalesce(user_stats.first_game_at, now()),
      last_game_at  = now(),
      last_seen_at  = now();
  end;
  $$;


--
-- Name: record_game_result(text, boolean, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_game_result(p_uid text, p_correct boolean, p_new_streak integer, p_longest_streak integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    insert into user_stats (uid, first_game_at, last_game_at, current_streak, longest_streak, total_games, total_correct)
    values (p_uid, now(), now(), p_new_streak, p_longest_streak, 1, case when p_correct then 1 else 0 end)
    on conflict (uid) do update set
      last_game_at   = now(),
      first_game_at  = coalesce(user_stats.first_game_at, now()),
      current_streak = p_new_streak,
      longest_streak = greatest(user_stats.longest_streak, p_new_streak),
      total_games    = user_stats.total_games + 1,
      total_correct  = user_stats.total_correct + case when p_correct then 1 else 0 end;
  end;
  $$;


--
-- Name: upsert_user_visit(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_user_visit(p_uid text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    insert into user_stats (uid) values (p_uid)
    on conflict (uid) do update set last_seen_at = now();
  end;
  $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: game_personalities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_personalities (
    id integer NOT NULL,
    person_id integer NOT NULL,
    full_name text NOT NULL,
    wikidata_id text,
    correct_answer text NOT NULL,
    wrong_answer_1 text,
    wrong_answer_2 text,
    wrong_answer_3 text,
    difficulty integer DEFAULT 3,
    created_at timestamp with time zone DEFAULT now(),
    last_shown_date date,
    CONSTRAINT game_personalities_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5)))
);


--
-- Name: game_personalities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_personalities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_personalities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_personalities_id_seq OWNED BY public.game_personalities.id;


--
-- Name: persons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persons (
    id integer NOT NULL,
    full_name text NOT NULL,
    birth_place_raw text,
    wikidata_id text,
    wiki_url text,
    created_at timestamp with time zone DEFAULT now(),
    birth_place_by_wikidata text,
    "QID_of_birth_place" text,
    wikipage_wordcount bigint,
    num_wiki_languages integer
);


--
-- Name: persons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.persons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: persons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.persons_id_seq OWNED BY public.persons.id;


--
-- Name: system_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_state (
    key text NOT NULL,
    value bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_stats (
    uid text NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now(),
    last_seen_at timestamp with time zone DEFAULT now(),
    first_game_at timestamp with time zone,
    last_game_at timestamp with time zone,
    current_streak integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    total_games integer DEFAULT 0,
    total_correct integer DEFAULT 0
);


--
-- Name: game_personalities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_personalities ALTER COLUMN id SET DEFAULT nextval('public.game_personalities_id_seq'::regclass);


--
-- Name: persons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons ALTER COLUMN id SET DEFAULT nextval('public.persons_id_seq'::regclass);


--
-- Name: game_personalities game_personalities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_personalities
    ADD CONSTRAINT game_personalities_pkey PRIMARY KEY (id);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: persons persons_wikidata_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_wikidata_id_key UNIQUE (wikidata_id);


--
-- Name: system_state system_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_state
    ADD CONSTRAINT system_state_pkey PRIMARY KEY (key);


--
-- Name: user_stats user_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stats
    ADD CONSTRAINT user_stats_pkey PRIMARY KEY (uid);


--
-- Name: idx_persons_birth_place_raw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_birth_place_raw ON public.persons USING btree (birth_place_raw);


--
-- Name: idx_persons_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_full_name ON public.persons USING btree (full_name);


--
-- Name: persons Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.persons FOR SELECT USING (true);


--
-- Name: game_personalities anon_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all ON public.game_personalities TO anon USING (true) WITH CHECK (true);


--
-- Name: user_stats anon_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all ON public.user_stats TO anon USING (true) WITH CHECK (true);


--
-- Name: game_personalities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.game_personalities ENABLE ROW LEVEL SECURITY;

--
-- Name: persons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

--
-- Name: system_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_state ENABLE ROW LEVEL SECURITY;

--
-- Name: user_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION record_game_open(p_uid text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.record_game_open(p_uid text) TO anon;
GRANT ALL ON FUNCTION public.record_game_open(p_uid text) TO authenticated;
GRANT ALL ON FUNCTION public.record_game_open(p_uid text) TO service_role;


--
-- Name: FUNCTION record_game_result(p_uid text, p_correct boolean, p_new_streak integer, p_longest_streak integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.record_game_result(p_uid text, p_correct boolean, p_new_streak integer, p_longest_streak integer) TO anon;
GRANT ALL ON FUNCTION public.record_game_result(p_uid text, p_correct boolean, p_new_streak integer, p_longest_streak integer) TO authenticated;
GRANT ALL ON FUNCTION public.record_game_result(p_uid text, p_correct boolean, p_new_streak integer, p_longest_streak integer) TO service_role;


--
-- Name: FUNCTION upsert_user_visit(p_uid text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.upsert_user_visit(p_uid text) TO anon;
GRANT ALL ON FUNCTION public.upsert_user_visit(p_uid text) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_user_visit(p_uid text) TO service_role;


--
-- Name: TABLE game_personalities; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.game_personalities TO anon;
GRANT ALL ON TABLE public.game_personalities TO authenticated;
GRANT ALL ON TABLE public.game_personalities TO service_role;


--
-- Name: SEQUENCE game_personalities_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.game_personalities_id_seq TO anon;
GRANT ALL ON SEQUENCE public.game_personalities_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.game_personalities_id_seq TO service_role;


--
-- Name: TABLE persons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.persons TO anon;
GRANT ALL ON TABLE public.persons TO authenticated;
GRANT ALL ON TABLE public.persons TO service_role;


--
-- Name: SEQUENCE persons_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.persons_id_seq TO anon;
GRANT ALL ON SEQUENCE public.persons_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.persons_id_seq TO service_role;


--
-- Name: TABLE system_state; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_state TO anon;
GRANT ALL ON TABLE public.system_state TO authenticated;
GRANT ALL ON TABLE public.system_state TO service_role;


--
-- Name: TABLE user_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_stats TO anon;
GRANT ALL ON TABLE public.user_stats TO authenticated;
GRANT ALL ON TABLE public.user_stats TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict glqBJlYzu5gTAqxMvHVevSQ1TSO3LHzXhYPeb1JoU98UuQt23kvcojypA4AjQe3

