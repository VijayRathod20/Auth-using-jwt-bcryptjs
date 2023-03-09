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
    const jwtToken = req.cookies.jwtToken;
    if(jwtToken){
        return res.redirect("/home");
    }
    res.render("registration");
});


//user registration
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    var sql = `select * from user where email = '${email}'`;
    var result = await conn.execute(sql);

    console.log("query result"+result[0]);
    if (result[0].length != 0) {
        return res.send(`User Already registered! please Login <a href="/login">login</a>`)
    }

    var hashPass = await bcrypt.hash(password, 10);
    console.log("hash " + hashPass);

    const activation_token = Math.random().toString(36).substring(2, 15);
    const activationLink = `http://localhost:3000/activate?token=${activation_token}`;
    var sql = `insert into user(name,email,password,activation_token) values('${name}','${email}','${hashPass}','${activation_token}')`;
    var result = await conn.execute(sql);
    console.log(result[0])

    //activation
   

    res.send(`user register successfully!  <a href="${activationLink}"> Activate Account </a>`)


});

app.get("/activate?",async (req,res)=>{
    const actKey = req.query.token;
    sql = `update user set activated = 1 where activation_token = "${actKey}"`;
    var result = await conn.execute(sql);
    var json = JSON.stringify(result);
    console.log("activate result "+ json)
    var arr = JSON.parse(json);
    if(arr[0].affectedRows == 0){
        res.send("invalid activation link");
    }else{
        res.redirect("/login");
    }
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
    const data = result[0];
    //comparing password
    let bpass = data[0].password;
    console.log("bpass", bpass)
    var match = await bcrypt.compare(password, bpass);
    console.log(match);
    if (!match) {
        return res.send(`wrong user or password!`)
    }
    const activationLink = `http://localhost:3000/activate?token=${data[0].activation_token}`;
    if(data[0].activated == 0){
       return res.render("activate",{activationLink});
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