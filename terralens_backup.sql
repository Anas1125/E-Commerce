--
-- PostgreSQL database dump
--

\restrict hjc6DVKYyIZPOgesOPzDLtSkcLgcRRddvoTPco0br9h2rcL7Uc9s8Bub8AHcAuz

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id integer NOT NULL,
    user_id integer NOT NULL,
    address_line1 character varying(255) NOT NULL,
    address_line2 character varying(255),
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    postal_code character varying(20) NOT NULL,
    country character varying(100) NOT NULL,
    is_default boolean NOT NULL
);


--
-- Name: addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.addresses_id_seq OWNED BY public.addresses.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    logo_url character varying(500),
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: brands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id integer NOT NULL,
    cart_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL
);


--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cart_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: carts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carts_id_seq OWNED BY public.carts.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    image_url character varying(500)
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: coupon_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_usages (
    id integer NOT NULL,
    coupon_id integer NOT NULL,
    user_id integer NOT NULL,
    order_id integer NOT NULL,
    used_at timestamp without time zone NOT NULL
);


--
-- Name: coupon_usages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coupon_usages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coupon_usages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coupon_usages_id_seq OWNED BY public.coupon_usages.id;


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    discount_type character varying(20) NOT NULL,
    value numeric(12,2) NOT NULL,
    minimum_order_amount numeric(12,2) NOT NULL,
    maximum_discount numeric(12,2),
    usage_limit integer,
    used_count integer NOT NULL,
    per_user_limit integer NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    is_active boolean NOT NULL,
    first_order_only boolean NOT NULL
);


--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coupons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coupons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;


--
-- Name: discounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discounts (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    discount_type character varying(20) NOT NULL,
    value numeric(10,2) NOT NULL,
    product_id integer,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    is_active boolean NOT NULL
);


--
-- Name: discounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discounts_id_seq OWNED BY public.discounts.id;


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    reserved_quantity integer NOT NULL
);


--
-- Name: inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name character varying(200) NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    discount_amount numeric(12,2) NOT NULL,
    final_price numeric(12,2) NOT NULL
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    id integer NOT NULL,
    order_id integer NOT NULL,
    status character varying(30) NOT NULL,
    note text,
    changed_at timestamp without time zone NOT NULL
);


--
-- Name: order_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_status_history_id_seq OWNED BY public.order_status_history.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_number character varying(50) NOT NULL,
    user_id integer NOT NULL,
    shipping_address_id integer NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    discount_amount numeric(12,2) NOT NULL,
    shipping_fee numeric(12,2) NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    order_status character varying(30) NOT NULL,
    payment_status character varying(30) NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    shipping_address_line1 character varying(255) NOT NULL,
    shipping_address_line2 character varying(255),
    shipping_city character varying(100) NOT NULL,
    shipping_state character varying(100) NOT NULL,
    shipping_postal_code character varying(20) NOT NULL,
    shipping_country character varying(100) NOT NULL,
    payment_method character varying(30) DEFAULT 'cod'::character varying NOT NULL
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    order_id integer NOT NULL,
    payment_gateway character varying(50) NOT NULL,
    gateway_order_id character varying(255),
    gateway_payment_id character varying(255),
    payment_method character varying(50),
    amount numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    status character varying(30) NOT NULL,
    paid_at timestamp without time zone,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id integer NOT NULL,
    product_id integer NOT NULL,
    image_url character varying(500) NOT NULL,
    is_primary boolean NOT NULL,
    display_order integer NOT NULL
);


--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    slug character varying(200) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    category_id integer NOT NULL,
    stock integer NOT NULL,
    rating numeric(2,1) NOT NULL,
    is_active boolean NOT NULL,
    brand_id integer
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id integer NOT NULL,
    order_id integer NOT NULL,
    payment_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason character varying(500),
    status character varying(30) NOT NULL,
    gateway_refund_id character varying(255),
    requested_at timestamp without time zone NOT NULL,
    completed_at timestamp without time zone
);


--
-- Name: refunds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refunds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refunds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refunds_id_seq OWNED BY public.refunds.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    rating integer NOT NULL,
    title character varying(200),
    comment text,
    is_verified_purchase boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    CONSTRAINT ck_review_rating CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    id integer NOT NULL,
    navbar_logo_url character varying(500),
    hero_image_url character varying(500),
    footer_logo_url character varying(500),
    favicon_url character varying(500),
    site_name character varying(150) NOT NULL
);


--
-- Name: site_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: site_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_settings_id_seq OWNED BY public.site_settings.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100),
    email character varying(255) NOT NULL,
    phone_number character varying(20) NOT NULL,
    password_hash character varying(255) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    role character varying(20) NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist_items (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL
);


--
-- Name: wishlist_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wishlist_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wishlist_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wishlist_items_id_seq OWNED BY public.wishlist_items.id;


--
-- Name: addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses ALTER COLUMN id SET DEFAULT nextval('public.addresses_id_seq'::regclass);


--
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- Name: cart_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);


--
-- Name: carts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts ALTER COLUMN id SET DEFAULT nextval('public.carts_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: coupon_usages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usages ALTER COLUMN id SET DEFAULT nextval('public.coupon_usages_id_seq'::regclass);


--
-- Name: coupons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);


--
-- Name: discounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts ALTER COLUMN id SET DEFAULT nextval('public.discounts_id_seq'::regclass);


--
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: order_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history ALTER COLUMN id SET DEFAULT nextval('public.order_status_history_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: refunds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds ALTER COLUMN id SET DEFAULT nextval('public.refunds_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: site_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings ALTER COLUMN id SET DEFAULT nextval('public.site_settings_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wishlist_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items ALTER COLUMN id SET DEFAULT nextval('public.wishlist_items_id_seq'::regclass);


--
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.addresses (id, user_id, address_line1, address_line2, city, state, postal_code, country, is_default) FROM stdin;
1	1	42 Green Valley Road	Near Sunrise Park	Nagercoil	Tamil Nadu	629001	India	t
2	2	10	town	ngl	tn	54333	India	f
3	3	11	string	string	string	string	India	f
4	4	ff	efwfwe	ffewfwe	34234	fwfwf	India	t
5	6	frwef	\N	fewfewf	sgfwrgrw	wg4r	India	t
7	7	55	\N	ngl	kl	555999	India	t
8	8	44	veppamodu	nagercoil	tamil nadu	629005	India	t
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
9ddc254f2c77
\.


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.brands (id, name, logo_url, is_active, created_at, updated_at) FROM stdin;
2	Autel	/uploads/brands/969735e6cf2a429a95a5be392f4cc772.png	t	2026-10-02 04:31:13.065293	2026-10-02 04:46:05.40958
4	Boat	/uploads/brands/d3240e0c254c4cc0b665b835f7cbc3aa.png	t	2026-10-02 04:31:13.065293	2026-10-02 04:46:48.029928
1	dell	/uploads/brands/be79622ae14c40c79f160d8b73e55900.png	t	2026-10-02 04:31:13.065293	2026-10-02 04:55:26.099036
3	Dji	/uploads/brands/fae0b4d881ef4076b6114e55d99d9b1c.png	t	2026-10-02 04:31:13.065293	2026-10-02 04:55:46.878691
16	Adidas	/uploads/brands/937c6bc8f5a04404a6895a3cf1c75021.png	t	2026-10-02 08:55:53.380582	2026-10-02 09:01:39.365614
12	Apple	/uploads/brands/c0c92ed1631c4c188958e59ed485b374.png	t	2026-10-02 08:33:15.970206	2026-10-02 09:02:04.818168
9	Canon	/uploads/brands/593fc80e91444141b02f5d96cc1508e6.png	t	2026-10-02 08:27:41.294223	2026-10-02 09:02:24.629033
14	Casio	/uploads/brands/37c01aaff59c41f09728e74c395ff1f5.jpg	t	2026-10-02 08:50:31.237143	2026-10-02 09:02:41.810071
13	Citizen	/uploads/brands/cd5ad56880a94cbf9cd7fc4321c52ef8.svg	t	2026-10-02 08:49:29.802998	2026-10-02 09:03:03.423829
15	Nike	/uploads/brands/b7e7985ef7174d38b7f1e293eb1d7310.png	t	2026-10-02 08:54:46.964852	2026-10-02 09:04:03.855957
11	Samsung	/uploads/brands/4bd36a0799dc4a839b2370272be4a4b9.webp	t	2026-10-02 08:33:04.556296	2026-10-02 09:04:23.908121
8	Sony	/uploads/brands/63effdfb04b94b4b8e9eacbe16577929.png	t	2026-10-02 08:26:28.879656	2026-10-02 09:04:48.335639
\.


--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cart_items (id, cart_id, product_id, quantity) FROM stdin;
3	1	3	1
9	4	3	1
17	2	10	4
\.


--
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.carts (id, user_id) FROM stdin;
1	1
2	2
3	3
4	4
5	6
6	7
7	8
8	9
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, slug, image_url) FROM stdin;
1	Consumer Electronics	consumer-electronics	http://localhost:8000/uploads/categories/291c75537d0a478ea39adf81039ce639.png
4	Drone	drones	http://localhost:8000/uploads/categories/9d9e8d32f428495c8bf8419a26e0ea19.png
5	Camera	cameras	http://localhost:8000/uploads/categories/6dd1fe102f60401292817445dad5152d.png
6	Mobiles	mobiles	http://localhost:8000/uploads/categories/73fa0b79a5014f17b692af5d0bde83ea.png
7	Laptops	laptop	http://localhost:8000/uploads/categories/bec760d24a564028a1de4f9c9c9de960.png
8	Tablets	tab	http://localhost:8000/uploads/categories/86e2e9a4f73146de96002c82a93b2c46.jpeg
9	Watches	watch	http://localhost:8000/uploads/categories/c7024caeebfc4ea4bbb9f29b126d8ae6.png
10	Shoes	shoe	http://localhost:8000/uploads/categories/9806dae68c9c46d18d4997d5ff06cbd9.png
\.


--
-- Data for Name: coupon_usages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coupon_usages (id, coupon_id, user_id, order_id, used_at) FROM stdin;
1	1	2	2	2026-10-01 06:57:17.167676
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coupons (id, code, name, discount_type, value, minimum_order_amount, maximum_discount, usage_limit, used_count, per_user_limit, start_date, end_date, is_active, first_order_only) FROM stdin;
1	WELCOME2	string	percentage	1.00	0.00	1.00	1	1	1	2026-10-01 11:51:00	2027-10-02 11:51:00	f	t
\.


--
-- Data for Name: discounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.discounts (id, name, discount_type, value, product_id, start_date, end_date, is_active) FROM stdin;
4	Adidas 205	percentage	20.00	20	2026-10-04 13:28:00	2026-10-12 13:28:00	t
5	Citizen 10%	percentage	10.00	17	2026-10-02 13:32:00	2026-10-31 13:32:00	t
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory (id, product_id, quantity, reserved_quantity) FROM stdin;
1	1	100	0
3	3	43	2
6	6	2	0
4	4	44	4
9	9	2	0
10	10	32	0
12	12	2	0
13	13	15	0
15	15	3	0
16	16	3	0
5	5	5	4
19	19	2	0
17	17	1	1
14	14	5	1
11	11	1	1
2	2	53	6
20	20	2	1
18	18	5	2
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, order_id, product_id, product_name, quantity, unit_price, discount_amount, final_price) FROM stdin;
1	1	2	Computer	4	1000.00	2000.00	500.00
2	2	2	Computer	1	1000.00	500.00	500.00
3	3	3	Test Mouse	2	999.00	0.00	999.00
4	4	3	Test Mouse	3	999.00	0.00	999.00
5	5	3	Test Mouse	1	999.00	0.00	999.00
6	6	3	Test Mouse	1	999.00	0.00	999.00
7	7	3	Test Mouse	2	999.00	0.00	999.00
8	8	4	Headphone	2	700.00	0.00	700.00
9	9	5	Dji osmo	2	35000.00	0.00	35000.00
10	10	4	Headphone	2	700.00	0.00	700.00
11	11	5	Dji osmo	1	35000.00	0.00	35000.00
12	12	5	Dji osmo	1	35000.00	0.00	35000.00
13	13	20	Adiddas Samba	1	12000.00	0.00	12000.00
14	14	18	Casio Gshock 554	1	55000.00	0.00	55000.00
15	15	5	Dji osmo	1	35000.00	0.00	35000.00
16	16	19	Nike Airforce 	1	10000.00	0.00	10000.00
17	17	17	Citizen BL539	1	35000.00	0.00	35000.00
18	18	14	Dell Alienware	1	200000.00	0.00	200000.00
19	19	11	Iphone 18 Pro Max	1	180000.00	0.00	180000.00
20	20	2	Computer	1	1000.00	0.00	1000.00
\.


--
-- Data for Name: order_status_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_status_history (id, order_id, status, note, changed_at) FROM stdin;
1	1	pending	Order created	2026-10-01 06:43:09.452004
2	2	pending	Order created	2026-10-01 06:57:17.16612
3	3	pending	Order created	2026-10-01 07:09:28.282199
4	3	confirmed	Payment completed successfully	2026-10-01 07:13:18.8771
5	4	pending	Order created	2026-10-01 07:15:27.277929
6	4	confirmed	Payment completed successfully	2026-10-01 07:16:54.478759
7	5	pending	Order created	2026-10-01 07:26:09.6325
8	5	cancelled	Payment failed	2026-10-01 07:28:24.646871
9	6	pending	Order created	2026-10-01 08:06:13.802619
10	6	cancelled	Order cancelled by customer	2026-10-01 08:06:27.73463
11	4	processing	Order packed and ready for processing	2026-10-01 08:22:30.646538
12	4	shipped	Order shipped to customer	2026-10-01 08:38:44.459001
13	7	pending	Order created	2026-10-01 10:48:00.27308
14	8	confirmed	COD order confirmed; payment is due on delivery	2026-10-01 12:16:12.980355
15	9	confirmed	COD order confirmed; payment is due on delivery	2026-10-01 16:35:58.689464
16	10	confirmed	COD order confirmed; payment is due on delivery	2026-10-02 06:53:58.911324
17	11	confirmed	COD order confirmed; payment is due on delivery	2026-10-02 07:09:43.256547
18	8	processing	\N	2026-10-02 10:12:12.366686
19	8	shipped	\N	2026-10-02 10:12:15.182969
20	8	out_for_delivery	\N	2026-10-02 10:12:17.381183
21	12	confirmed	COD order confirmed; payment is due on delivery	2026-10-02 10:50:31.563844
22	12	processing	\N	2026-10-02 10:50:50.264302
23	12	shipped	\N	2026-10-02 10:51:11.417226
24	12	out_for_delivery	\N	2026-10-02 10:51:13.871155
25	12	delivered	\N	2026-10-02 10:51:16.245212
26	13	confirmed	COD order confirmed; payment is due on delivery	2026-10-05 04:36:05.849858
27	13	processing	\N	2026-10-05 04:36:44.211511
28	13	shipped	\N	2026-10-05 04:36:46.205253
29	13	out_for_delivery	\N	2026-10-05 04:36:48.230299
30	13	delivered	\N	2026-10-05 04:36:50.566421
31	14	confirmed	COD order confirmed; payment is due on delivery	2026-10-05 05:11:34.414105
32	14	processing	\N	2026-10-05 05:11:50.578511
33	14	shipped	\N	2026-10-05 05:11:52.545354
34	14	out_for_delivery	\N	2026-10-05 05:11:54.640765
35	14	delivered	\N	2026-10-05 05:11:57.032128
36	15	confirmed	COD order confirmed; payment is due on delivery	2026-10-05 05:12:31.112852
37	15	cancelled	Order cancelled by customer	2026-10-05 05:18:23.270509
38	16	confirmed	COD order confirmed; payment is due on delivery	2026-10-05 07:07:53.695172
39	16	cancelled	Order cancelled by customer	2026-10-05 07:12:38.603899
40	17	confirmed	COD order confirmed; payment is due on delivery	2026-10-05 07:37:28.509765
41	18	confirmed	COD order confirmed; payment is due on delivery	2026-10-05 07:37:44.593512
42	19	confirmed	COD order confirmed; payment is due on delivery	2026-10-05 07:38:00.432143
43	20	confirmed	COD order confirmed; payment is due on delivery	2026-10-05 08:05:29.495621
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, order_number, user_id, shipping_address_id, subtotal, discount_amount, shipping_fee, total_amount, order_status, payment_status, created_at, updated_at, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_postal_code, shipping_country, payment_method) FROM stdin;
18	TL-20261005073744-A55D64	8	8	200000.00	0.00	0.00	200000.00	confirmed	pending	2026-10-05 07:37:44.586587	2026-10-05 07:37:44.586595	44	veppamodu	nagercoil	tamil nadu	629005	India	cod
19	TL-20261005073800-80BB75	8	8	180000.00	0.00	0.00	180000.00	confirmed	pending	2026-10-05 07:38:00.427124	2026-10-05 07:38:00.42713	44	veppamodu	nagercoil	tamil nadu	629005	India	cod
20	TL-20261005080529-57EBF9	8	8	1000.00	0.00	0.00	1000.00	confirmed	pending	2026-10-05 08:05:29.484588	2026-10-05 08:05:29.484592	44	veppamodu	nagercoil	tamil nadu	629005	India	cod
1	TL-20261001064309-383181	1	1	4000.00	2000.00	0.00	2000.00	pending	pending	2026-10-01 06:43:09.443429	2026-10-01 06:43:09.443432	42 Green Valley Road	Near Sunrise Park	Nagercoil	Tamil Nadu	629001	India	cod
2	TL-20261001065717-8E1A14	2	2	1000.00	600.00	0.00	400.00	pending	pending	2026-10-01 06:57:17.158494	2026-10-01 06:57:17.158497	10	town	ngl	tn	54333	India	cod
3	TL-20261001070928-3222AE	3	3	1998.00	0.00	0.00	1998.00	confirmed	paid	2026-10-01 07:09:28.275696	2026-10-01 07:13:18.873764	11	string	string	string	string	India	cod
5	TL-20261001072609-946832	3	3	999.00	0.00	0.00	999.00	cancelled	failed	2026-10-01 07:26:09.62466	2026-10-01 07:28:24.646388	11	string	string	string	string	India	cod
6	TL-20261001080613-CA17FC	3	3	999.00	0.00	0.00	999.00	cancelled	pending	2026-10-01 08:06:13.794678	2026-10-01 08:06:27.734189	11	string	string	string	string	India	cod
4	TL-20261001071527-FF9E32	3	3	2997.00	0.00	0.00	2997.00	shipped	paid	2026-10-01 07:15:27.272486	2026-10-01 08:38:44.453694	11	string	string	string	string	India	cod
7	TL-20261001104800-8E348F	4	4	1998.00	0.00	0.00	1998.00	pending	pending	2026-10-01 10:48:00.260177	2026-10-01 10:48:00.260179	ff	efwfwe	ffewfwe	34234	fwfwf	India	cod
9	TL-20261001163558-7E28EA	6	5	70000.00	0.00	0.00	70000.00	confirmed	pending	2026-10-01 16:35:58.681092	2026-10-01 16:35:58.681095	frwef	\N	fewfewf	sgfwrgrw	wg4r	India	cod
10	TL-20261002065358-F6370D	6	5	1400.00	0.00	0.00	1400.00	confirmed	pending	2026-10-02 06:53:58.896215	2026-10-02 06:53:58.896218	frwef	\N	fewfewf	sgfwrgrw	wg4r	India	cod
11	TL-20261002070943-B6BF8C	7	7	35000.00	0.00	0.00	35000.00	confirmed	pending	2026-10-02 07:09:43.249235	2026-10-02 07:09:43.24924	55	\N	ngl	kl	555999	India	cod
8	TL-20261001121612-BC01DB	2	2	1400.00	0.00	0.00	1400.00	delivered	paid	2026-10-01 12:16:12.967677	2026-10-02 10:17:56.809918	10	town	ngl	tn	54333	India	cod
12	TL-20261002105031-95CC53	2	2	35000.00	0.00	0.00	35000.00	delivered	paid	2026-10-02 10:50:31.554484	2026-10-02 10:51:16.243057	10	town	ngl	tn	54333	India	cod
13	TL-20261005043605-E71327	8	8	12000.00	0.00	0.00	12000.00	delivered	paid	2026-10-05 04:36:05.83774	2026-10-05 04:36:50.564967	44	veppamodu	nagercoil	tamil nadu	629005	India	cod
14	TL-20261005051134-730332	8	8	55000.00	0.00	0.00	55000.00	delivered	paid	2026-10-05 05:11:34.40444	2026-10-05 05:11:57.031199	44	veppamodu	nagercoil	tamil nadu	629005	India	cod
15	TL-20261005051231-8A2E59	8	8	35000.00	0.00	0.00	35000.00	cancelled	pending	2026-10-05 05:12:31.110638	2026-10-05 05:18:23.269823	44	veppamodu	nagercoil	tamil nadu	629005	India	cod
16	TL-20261005070753-82156F	8	8	10000.00	0.00	0.00	10000.00	cancelled	pending	2026-10-05 07:07:53.683459	2026-10-05 07:12:38.602058	44	veppamodu	nagercoil	tamil nadu	629005	India	cod
17	TL-20261005073728-645C26	8	8	35000.00	0.00	0.00	35000.00	confirmed	pending	2026-10-05 07:37:28.50371	2026-10-05 07:37:28.503712	44	veppamodu	nagercoil	tamil nadu	629005	India	cod
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at) FROM stdin;
4	9	5f11e534996a398a97617187e9f04a066c59c48cfdc0dc7bdd9683798a180d80	2026-10-05 06:13:19.37154	t	2026-10-05 05:43:19.372176
5	9	9c0899cf3662c608861cc9271be5c4451020f1f7553f38945cdfa0cdc3602657	2026-10-05 06:17:46.029973	t	2026-10-05 05:47:46.035601
6	9	c95991acad4d815b561b72c69ade48f020a4c79a73a1699b6e9faa3170313a30	2026-10-05 06:25:10.961974	t	2026-10-05 05:55:10.96699
7	9	bc466c79938ce09ec4807bb77b2b1ce93d51a969b173a816f6c9734d325787ae	2026-10-05 06:25:31.287027	t	2026-10-05 05:55:31.290508
8	9	19bfe8b645e70600748f84bb6361356105e5c5fbb3b4956d400225de928e0db0	2026-10-05 06:27:27.913331	t	2026-10-05 05:57:27.915086
9	9	4264901ea3446b1079b9f9aacbb9e392fa58f6ff5132ce7da36d0cf6f9d4c98f	2026-10-05 06:29:28.174708	t	2026-10-05 05:59:28.177938
10	9	f23e5f4df03ea8c416012d1f768ba374f3dda41752d5e02bbfa724a501cd2f3b	2026-10-05 07:55:23.323021	t	2026-10-05 07:25:23.324762
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, order_id, payment_gateway, gateway_order_id, gateway_payment_id, payment_method, amount, currency, status, paid_at, created_at) FROM stdin;
1	3	razorpay	\N	pay_test_001	card	1998.00	INR	paid	2026-10-01 07:13:18.870881	2026-10-01 07:09:50.80156
2	4	razorpay	\N	pay_test_002	card	2997.00	INR	paid	2026-10-01 07:16:54.47668	2026-10-01 07:15:41.563903
3	5	razorpay	\N	\N	\N	999.00	INR	failed	\N	2026-10-01 07:27:05.020097
4	7	razorpay	\N	\N	\N	1998.00	INR	pending	\N	2026-10-01 10:48:00.293525
6	9	cod	\N	\N	cod	70000.00	INR	pending	\N	2026-10-01 16:35:58.690962
7	10	cod	\N	\N	cod	1400.00	INR	pending	\N	2026-10-02 06:53:58.913151
8	11	cod	\N	\N	cod	35000.00	INR	pending	\N	2026-10-02 07:09:43.257353
5	8	cod	\N	\N	cod	1400.00	INR	paid	\N	2026-10-01 12:16:12.981984
9	12	cod	\N	\N	cod	35000.00	INR	paid	\N	2026-10-02 10:50:31.565937
10	13	cod	\N	\N	cod	12000.00	INR	paid	\N	2026-10-05 04:36:05.853052
11	14	cod	\N	\N	cod	55000.00	INR	paid	\N	2026-10-05 05:11:34.415563
12	15	cod	\N	\N	cod	35000.00	INR	pending	\N	2026-10-05 05:12:31.113241
13	16	cod	\N	\N	cod	10000.00	INR	pending	\N	2026-10-05 07:07:53.69806
14	17	cod	\N	\N	cod	35000.00	INR	pending	\N	2026-10-05 07:37:28.51153
15	18	cod	\N	\N	cod	200000.00	INR	pending	\N	2026-10-05 07:37:44.594333
16	19	cod	\N	\N	cod	180000.00	INR	pending	\N	2026-10-05 07:38:00.432831
17	20	cod	\N	\N	cod	1000.00	INR	pending	\N	2026-10-05 08:05:29.497419
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_images (id, product_id, image_url, is_primary, display_order) FROM stdin;
1	1	https://example.com/products/headphones-main.jpg	t	0
2	1	https://example.com/products/headphones-side.jpg	f	1
4	3	http://localhost:8000/uploads/products/48c615c0d02748628d9c41e0cfe406b4.png	t	0
5	2	http://localhost:8000/uploads/products/2da641eb216940d0b23a68b8bc77ba9d.png	t	0
6	4	http://localhost:8000/uploads/products/261fed3dac504659afaaa35a9c8ff8ea.png	t	0
7	5	http://localhost:8000/uploads/products/389a0f4f97564f569bc90f79fe5dbdde.png	t	0
8	6	http://localhost:8000/uploads/products/56b8495800574bdcbfc2b9a4f6b5ebe8.png	t	0
9	9	http://localhost:8000/uploads/products/5b2168dc80b04b7388cd3ffd93739cad.png	t	0
10	10	http://localhost:8000/uploads/products/48de733905d541ebb81c7eee79c13dbb.png	t	0
11	11	http://localhost:8000/uploads/products/4d7049a9f26e40bba0eddbcaa07d8a95.png	t	0
12	12	http://localhost:8000/uploads/products/e5f6c1d60a8544d9a2ad78969f684d7f.png	t	0
13	13	http://localhost:8000/uploads/products/1f995047fb584ce79cba63dfde0206d2.png	t	0
14	14	http://localhost:8000/uploads/products/e5ac6ed4014a41eeb88a68225396e4db.jpeg	t	0
15	15	http://localhost:8000/uploads/products/ab5cf110e19b430e92db5e641be190b9.jpeg	t	0
16	16	http://localhost:8000/uploads/products/ff5a7d72345e43ca88fa3b9ca4af8fde.jpeg	t	0
17	17	http://localhost:8000/uploads/products/6817a40d8d9446b98cc0850e3087e11e.png	t	0
18	18	http://localhost:8000/uploads/products/8cd6f6d5e51f41bca34bc523bca6037f.png	t	0
19	19	http://localhost:8000/uploads/products/61d531b86c4140f3880083c176b474f0.jpeg	t	0
20	20	http://localhost:8000/uploads/products/4f8f56961ba943c8b6d6f7716ec25294.jpeg	t	0
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, name, slug, description, price, category_id, stock, rating, is_active, brand_id) FROM stdin;
2	Computer	computer	this is computer	1000.00	1	53	0.0	t	1
6	Autel drone	autel-drone	THIS IS A DRONE FROM AUTEL	30000.00	4	2	0.0	t	2
1	Wireless Bluetooth Headphones Pro	wireless-bluetooth-headphones-pro	Updated sample headphones.	2999.00	1	5	0.0	f	\N
3	Test Mouse	test-mouse	Test product	999.00	1	43	0.0	f	\N
9	Sony	song-camera	This is a camera from sony	45000.00	5	2	0.0	t	8
10	Canon camera	canon-camera	This is a camera from canon company	25000.00	5	32	0.0	t	9
12	S26 ultra	samsung	this is an smartphone from samsung 	160000.00	6	2	0.0	t	11
11	Iphone 18 Pro Max	apple	This is an iphone from apple company	180000.00	6	1	0.0	t	12
13	Macbook Neo	apple-macbook	This is an high performance laptop from APPLE	70000.00	7	15	0.0	t	12
14	Dell Alienware	dell-alienware	This is an high performance laptop from dell	200000.00	7	2	0.0	t	1
15	Ipad pro 7	ipad-pro-7	This is an high performance ipad from apple	120000.00	8	3	0.0	t	12
16	samsung tab 2	samsung-tab-2	this is an tablet from samsung	400000.00	8	3	0.0	t	11
17	Citizen BL539	citizen-bl539	this is an luxury watch 	35000.00	9	1	0.0	t	13
19	Nike Airforce 	nike-airforce	this a premium shoe from nike	10000.00	10	2	0.0	t	15
4	Headphone	headphone	This is headphone from boat company	700.00	1	44	5.0	t	4
5	Dji osmo	dji	THIS IS A DRONE FROM DJI	35000.00	4	5	4.0	t	3
20	Adiddas Samba	adidas-samba	this is an luxury shoe from adidas	12000.00	10	2	4.0	t	16
18	Casio Gshock 554	casio-gshock-554	this is an luxury watch 	55000.00	9	5	0.0	t	14
\.


--
-- Data for Name: refunds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refunds (id, order_id, payment_id, amount, reason, status, gateway_refund_id, requested_at, completed_at) FROM stdin;
1	4	2	999.00	Customer requested partial refund	completed	rfnd_test_001	2026-10-01 08:09:19.549317	2026-10-01 08:16:15.482069
2	12	9	35000.00	Reason: Wrong product received\n\nWhat went wrong: its eotngh	approved	\N	2026-10-02 10:52:11.560066	\N
3	14	11	55000.00	Reason: Wrong product received\n\nWhat went wrong: its worng	requested	\N	2026-10-05 07:15:57.361872	\N
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reviews (id, user_id, product_id, rating, title, comment, is_verified_purchase, created_at, status) FROM stdin;
2	2	4	5	Great product	Really happy with the quality.	t	2026-10-02 10:18:39.496628	approved
3	2	5	4	good	it was good	t	2026-10-02 10:52:01.708733	approved
4	8	20	4	good	fits perfectly well	t	2026-10-05 04:37:24.861058	approved
5	8	18	4	good	giood	t	2026-10-05 07:18:23.251647	pending
\.


--
-- Data for Name: site_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site_settings (id, navbar_logo_url, hero_image_url, footer_logo_url, favicon_url, site_name) FROM stdin;
1	http://localhost:8000/uploads/branding/e298864fdb8b4a91af2088d713157a1b.png	http://localhost:8000/uploads/branding/ac9e10d115834d9197e34edd7a771447.png	http://localhost:8000/uploads/branding/795973675de14dbab05733e13897381e.png	http://localhost:8000/uploads/branding/8b51fc157a184a42864ec3bfa43ed746.png	TerraLens
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, first_name, last_name, email, phone_number, password_hash, is_active, created_at, updated_at, role) FROM stdin;
1	Anas	Test	anas-test@example.com	9876543210	$argon2id$v=19$m=65536,t=3,p=4$042QmvjULit32ML76yBSxw$lILij4JINwbFq7P1DQ6jbr9WgM+v9aZWAkWxDx0k4dY	t	2026-10-01 05:45:55.962812	2026-10-01 05:45:55.962826	customer
3	test	testing	test@example.com	987654321	$argon2id$v=19$m=65536,t=3,p=4$KtKvZAGynSlw6c64cWMcHw$dK+/fwC05NgSkV4nblgxECaz69YfdBTQQY/5aS9XL5Y	t	2026-10-01 07:06:50.367985	2026-10-01 08:47:56.184235	customer
4	Anas	\N	anasmohamed11220@gmail.com	9344380565	$argon2id$v=19$m=65536,t=3,p=4$2JBjba6WXoW+Ukm3MZLZkg$w33B+HKDpqpO5EWVsqtqNVdEl2XFv2BUuhOMHMxKcLI	t	2026-10-01 10:33:15.782746	2026-10-01 10:33:15.782752	customer
5	testing	\N	testing11@gmail.com	98765432	$argon2id$v=19$m=65536,t=3,p=4$C/BT8qiMPsz8NljYWB53UQ$QMOyCY2T4xEM6EeoNfI9W2BevofzylVU3T6rctCLUHc	t	2026-10-01 16:34:07.980309	2026-10-01 16:34:07.980316	customer
6	test	\N	test@gmail.com	5556666	$argon2id$v=19$m=65536,t=3,p=4$KUhQxa97ROZya7mn4Z9C1Q$Y1Iu7WjCA3BKy8/KOE3IC6pXBKA+Bpsw1D5TaZ6xY7w	t	2026-10-01 16:34:57.652743	2026-10-01 16:34:57.652749	customer
7	test2		test2@gmail.com	122234556	$argon2id$v=19$m=65536,t=3,p=4$VMFKupbIp62k+31SyCuASg$/c0CcykovPqwipZEIGWBxqSx0DMjmlOjZYVaVpAUSn8	t	2026-10-02 06:11:31.532141	2026-10-02 06:11:31.532159	customer
8	test3	\N	test3@gmail.com	12345678900	$argon2id$v=19$m=65536,t=3,p=4$IxnwNbtJ5++DrK6N904KzA$i82bINEAryGRI6Z+8ihZ4ff6/F0UKiclUGWJJOnDXqQ	t	2026-10-05 04:34:00.522768	2026-10-05 04:44:16.163873	customer
2	anas	\N	anas@gmail.com	9876543222	$argon2id$v=19$m=65536,t=3,p=4$E/ALuxHMOHbLRA6sqVe0uA$eeBvWPr5quNze4jra0fWOQMu0ef7ypDl6FfqcwWIKy0	t	2026-10-01 05:52:23.878687	2026-10-05 06:22:15.365955	admin
11	amch	\N	amch@gmail.com	6543334566	$argon2id$v=19$m=65536,t=3,p=4$13AbfVQjpAhpciTvZryuQg$VgHr1B9MDMHAKjUGPv72Jq1uI2laMSCr5hCci1tqGjs	t	2026-10-05 07:21:58.156727	2026-10-05 07:21:58.156732	customer
9	Meu	Know	meuknow660@gmail.com	932187229	$argon2id$v=19$m=65536,t=3,p=4$txMBMzKT5f498owchynX2w$v1wEsxrtqdF44EvNQWUXzJ2P/g+v9qP3sAd9PwaqFjc	t	2026-10-05 05:42:59.040439	2026-10-05 07:25:47.123649	customer
\.


--
-- Data for Name: wishlist_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wishlist_items (id, user_id, product_id) FROM stdin;
2	1	2
5	4	2
6	2	4
11	6	5
13	2	20
16	8	20
20	8	16
24	8	19
25	8	14
26	8	15
\.


--
-- Name: addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.addresses_id_seq', 8, true);


--
-- Name: brands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.brands_id_seq', 16, true);


--
-- Name: cart_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cart_items_id_seq', 26, true);


--
-- Name: carts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.carts_id_seq', 8, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 10, true);


--
-- Name: coupon_usages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coupon_usages_id_seq', 1, true);


--
-- Name: coupons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coupons_id_seq', 2, true);


--
-- Name: discounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.discounts_id_seq', 5, true);


--
-- Name: inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_id_seq', 20, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_items_id_seq', 20, true);


--
-- Name: order_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_status_history_id_seq', 43, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 20, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 10, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payments_id_seq', 17, true);


--
-- Name: product_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_images_id_seq', 20, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.products_id_seq', 20, true);


--
-- Name: refunds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.refunds_id_seq', 3, true);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reviews_id_seq', 5, true);


--
-- Name: site_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.site_settings_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 11, true);


--
-- Name: wishlist_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wishlist_items_id_seq', 26, true);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: brands brands_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_name_key UNIQUE (name);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: carts carts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_key UNIQUE (user_id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: coupon_usages coupon_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: discounts discounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts
    ADD CONSTRAINT discounts_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_product_id_key UNIQUE (product_id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: payments payments_gateway_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_gateway_order_id_key UNIQUE (gateway_order_id);


--
-- Name: payments payments_gateway_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_gateway_payment_id_key UNIQUE (gateway_payment_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: refunds refunds_gateway_refund_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_gateway_refund_id_key UNIQUE (gateway_refund_id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);


--
-- Name: reviews uq_user_product_review; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT uq_user_product_review UNIQUE (user_id, product_id);


--
-- Name: wishlist_items uq_user_product_wishlist; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT uq_user_product_wishlist UNIQUE (user_id, product_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);


--
-- Name: ix_addresses_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_addresses_id ON public.addresses USING btree (id);


--
-- Name: ix_brands_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_brands_id ON public.brands USING btree (id);


--
-- Name: ix_cart_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cart_items_id ON public.cart_items USING btree (id);


--
-- Name: ix_carts_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_carts_id ON public.carts USING btree (id);


--
-- Name: ix_categories_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_categories_id ON public.categories USING btree (id);


--
-- Name: ix_coupon_usages_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_coupon_usages_id ON public.coupon_usages USING btree (id);


--
-- Name: ix_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_coupons_code ON public.coupons USING btree (code);


--
-- Name: ix_coupons_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_coupons_id ON public.coupons USING btree (id);


--
-- Name: ix_discounts_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_discounts_id ON public.discounts USING btree (id);


--
-- Name: ix_inventory_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inventory_id ON public.inventory USING btree (id);


--
-- Name: ix_order_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_order_items_id ON public.order_items USING btree (id);


--
-- Name: ix_order_status_history_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_order_status_history_id ON public.order_status_history USING btree (id);


--
-- Name: ix_orders_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_id ON public.orders USING btree (id);


--
-- Name: ix_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_orders_order_number ON public.orders USING btree (order_number);


--
-- Name: ix_password_reset_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_password_reset_tokens_expires_at ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: ix_password_reset_tokens_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_password_reset_tokens_id ON public.password_reset_tokens USING btree (id);


--
-- Name: ix_password_reset_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_password_reset_tokens_token_hash ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: ix_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: ix_payments_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payments_id ON public.payments USING btree (id);


--
-- Name: ix_product_images_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_images_id ON public.product_images USING btree (id);


--
-- Name: ix_products_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_brand_id ON public.products USING btree (brand_id);


--
-- Name: ix_products_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_id ON public.products USING btree (id);


--
-- Name: ix_refunds_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refunds_id ON public.refunds USING btree (id);


--
-- Name: ix_reviews_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reviews_id ON public.reviews USING btree (id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_phone_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_phone_number ON public.users USING btree (phone_number);


--
-- Name: ix_wishlist_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wishlist_items_id ON public.wishlist_items USING btree (id);


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id);


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coupon_usages coupon_usages_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);


--
-- Name: coupon_usages coupon_usages_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: coupon_usages coupon_usages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: discounts discounts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts
    ADD CONSTRAINT discounts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: products fk_products_brand_id_brands; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_brand_id_brands FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE RESTRICT;


--
-- Name: inventory inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: orders orders_shipping_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_shipping_address_id_fkey FOREIGN KEY (shipping_address_id) REFERENCES public.addresses(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: refunds refunds_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: reviews reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wishlist_items wishlist_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: wishlist_items wishlist_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict hjc6DVKYyIZPOgesOPzDLtSkcLgcRRddvoTPco0br9h2rcL7Uc9s8Bub8AHcAuz

