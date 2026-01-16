"use client";
import React from "react";
import * as _Builtin from "./_Builtin";
import * as _utils from "./utils";
import _styles from "./Header.module.css";

export function Header({ as: _Component = _Builtin.DOM }) {
  return (
    <_Component
      className={_utils.cx(_styles, "style-header-3uk0i")}
      tag="header"
      slot=""
    >
      <_Builtin.DOM
        className={_utils.cx(_styles, "style-nav-715bj")}
        tag="nav"
        slot=""
        aria-label="Global"
      >
        <_Builtin.DOM
          className={_utils.cx(_styles, "style-div-hefrq")}
          tag="div"
          slot=""
        >
          <_Builtin.DOM
            className={_utils.cx(_styles, "style-div-bv5i0")}
            tag="div"
            slot=""
          >
            <_Builtin.DOM
              className={_utils.cx(_styles, "style-div-foon9")}
              tag="div"
              slot=""
            >
              <_Builtin.DOM
                className={_utils.cx(_styles, "style-img-v2zzu")}
                tag="img"
                slot=""
                alt="logo"
                src="https://placehold.co/141x36"
              />
            </_Builtin.DOM>
            <_Builtin.DOM
              className={_utils.cx(_styles, "style-div-yf7p1")}
              tag="div"
              slot=""
            >
              <_Builtin.DOM
                className={_utils.cx(_styles, "style-div-e98n2")}
                tag="div"
                slot=""
              >
                <_Builtin.DOM
                  className={_utils.cx(_styles, "style-a-npp64")}
                  tag="a"
                  slot=""
                  href="#"
                >
                  {"Features"}
                </_Builtin.DOM>
                <_Builtin.DOM
                  className={_utils.cx(_styles, "style-a-b4dsr")}
                  tag="a"
                  slot=""
                  href="#"
                >
                  {"Pricing"}
                </_Builtin.DOM>
                <_Builtin.DOM
                  className={_utils.cx(_styles, "style-a-79t9n")}
                  tag="a"
                  slot=""
                  href="#"
                >
                  {"Contact"}
                </_Builtin.DOM>
              </_Builtin.DOM>
            </_Builtin.DOM>
            <_Builtin.DOM
              className={_utils.cx(_styles, "style-div-fy8f6")}
              tag="div"
              slot=""
            >
              <_Builtin.DOM
                className={_utils.cx(_styles, "style-a-fmf5x")}
                tag="a"
                slot=""
                href="#"
              >
                <_Builtin.DOM tag="span" slot="">
                  {"Log in "}
                </_Builtin.DOM>
                <_Builtin.DOM tag="span" slot="" aria-hidden="true">
                  {"→"}
                </_Builtin.DOM>
              </_Builtin.DOM>
            </_Builtin.DOM>
          </_Builtin.DOM>
        </_Builtin.DOM>
      </_Builtin.DOM>
    </_Component>
  );
}
