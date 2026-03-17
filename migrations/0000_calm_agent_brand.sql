CREATE TABLE "erc20_balances" (
	"holder" varchar(42) NOT NULL,
	"token" varchar(42) NOT NULL,
	"balance" numeric DEFAULT '0' NOT NULL,
	CONSTRAINT "erc20_balances_holder_token_pk" PRIMARY KEY("holder","token")
);
