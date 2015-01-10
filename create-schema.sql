drop table if exists hits;

create table hits(
	user bigint unsigned,
	project bigint unsigned,
	time datetime,
	remoteIp char(15),
	country char(3),
	region char(32),
	city char(32),
	isp char(32),
	url char(255),
	referrer char(255),
	userAgent char(255),
	resolution char(11),
	id bigint unsigned auto_increment,
	primary key(id)
);

drop table if exists projects;

create table projects(
	user bigint unsigned,
	name char(32),
	id bigint unsigned auto_increment,
	primary key(id)
);

drop table if exists users;

create table users(
	name char(32),
	password char(128),
	id bigint unsigned auto_increment,
	primary key(id)
);