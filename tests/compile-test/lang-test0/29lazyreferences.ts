function testLazyRef() {
    msg("testLazyRef")
    let x = ("x" + "Y") || "foo"
    let y = "" || "bXr" + "2"
    assert(x.length == 2, "two")
    assert(y.length == 4, "emp")
    y = null || "foo"
    assert(y == "foo", "ln")

    x = "x" + "12x" && "7" + "xx"
    assert(x.length == 3, "and")

    x = "" && "blah"
    assert(x == "", "andemp")
    x = "foo" && "x" + "Y"
    assert(x.length == 2, "twoand")
    x = "x" + "Y" && "bar"
    assert(x.length == 3, "threeand")

    let z = 0 || 12
    assert(z == 12, "12")
    z = 12 || 13
    assert(z == 12, "12.2")
    z = 12 && 13
    assert(z == 13, "13")

    let q = new Testrec()
    let r: Testrec = null
    let qq = q && r
    assert(qq == null, "&n")
    qq = r && q
    assert(qq == null, "&r")
}
testLazyRef()
