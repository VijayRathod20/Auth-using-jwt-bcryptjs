const express = require('express')
const app = express();
const bodyParser = require("body-parser");
const bcrypt = require('bcryptjs');
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const path = require('path');
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.set("view engine", "ejs");
app.use(cookieParser());
app.use(express.static(path.join(__dirname,"/public")));

//connection
const conn = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "auth"
})

// conn.getConnection((err,conn)=>{
//     console.log("connected")
// })

app.get('/', (req, res) => {
    res.render("registration")
});

//user registration
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    var sql = `select * from user where email = '${email}'`;
    var result = conn.execute(sql);

    console.log(result[0]);
    if (result[0] != 0) {
        return res.send(`User Already registered! please Login <a href="/login">login</a>`)
    }


    var hashPass = await bcrypt.hash(password, 10);
    console.log("hash " + hashPass);

    var sql = `insert into user(name,email,password) values('${name}','${email}','${hashPass}')`;
    var result = await conn.execute(sql);
    console.log(result[0])
    res.send("user register successfully!")


});


//user login
app.get('/login', (req, res) => {
    res.render("login");
})

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    var varifyUser = `select * from user where email = '${email}'`;
    var result = await conn.execute(varifyUser);
    console.log(result);
    if (result[0].length == 0) {
        return res.send(`user not regitered please register <a href="/">register</a>`)
    }
    console.log(result[0]);
    const data = result[0];
    //comparing password
    let bpass = data[0].password;
    console.log("bpass", bpass)
    var match = await bcrypt.compare(password, bpass);
    console.log(match);
    if (!match) {
        return res.send(`wrong password!`)
    }

    //generating jwt token
    const jwtToken = jwt.sign(data[0], "vijay");
    res.cookie("jwtToken", jwtToken);
    
    res.redirect('/home');


})

app.get("/home", (req, res) => {

    const jwtToken = req.cookies.jwtToken;
    if (!jwtToken) {
        return res.send(`you are not authorized register first <a href="/">register</a>`);
    }
    const tokenData = jwt.verify(jwtToken, "vijay");
    res.render("home",{tokenData});

})

app.get("/logout", (req, res) => {
    res.clearCookie("jwtToken");
    res.redirect("/")

})


app.listen(port, () => console.log(`Example app listening on port ${port}!`))