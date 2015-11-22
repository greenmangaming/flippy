package com.xantoria.flippy.condition

import org.scalatest._

import com.xantoria.flippy.BaseSpec

class StringConditionsSpec extends BaseSpec {
  import StringConditions._

  "String conditions" should "allow matching a range" in {
    val r = new RangeCondition(Some("foxtrot"), Some("yankee"))
    r.appliesTo("bravo") should be (false)
    r.appliesTo("tango") should be (true)
    r.appliesTo("whisky") should be (true)
    r.appliesTo("zulu") should be (false)
  }

  it should "allow matching above a value" in {
    val r = new RangeCondition(low = Some("india"), high = None)
    r.appliesTo("charlie") should be (false)
    r.appliesTo("romeo") should be (true)
    r.appliesTo("zulu") should be (true)
  }

  it should "allow matching below a value" in {
    val r = new RangeCondition(low = None, high = Some("india"))
    r.appliesTo("charlie") should be (true)
    r.appliesTo("romeo") should be (false)
    r.appliesTo("zulu") should be (false)
  }

  it should "allow matching a substring" in {
    val cond1 = new SubstringCondition("mon")
    val cond2 = new SubstringCondition("key")

    cond1.appliesTo("monkey") should be (true)
    cond2.appliesTo("monkey") should be (true)
    cond1.appliesTo("keychain") should be (false)
    cond2.appliesTo("keychain") should be (true)
    cond1.appliesTo("monday") should be (true)
    cond2.appliesTo("monday") should be (false)

  }
}