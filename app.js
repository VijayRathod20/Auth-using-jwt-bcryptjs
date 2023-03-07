const express = require('express')
const app = express();
const bodyParser = require("body-parser");
const bcrypt = require('bcryptjs');
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.set("view engine","ejs");
app.use(cookieParser());

//connection
const conn = mysql.createPool({
    host:"localhost",
    user:"root",
    password:"root",
    database:"auth"
})

// conn.getConnection((err,conn)=>{
//     console.log("connected")
// })

app.get('/', (req, res) => {
    res.render("registration")
});

//user registration
app.post('/register',async (req,res)=>{
    const{name,email,password} = req.body;
    
    var hashPass = await bcrypt.hash(password,10);
    console.log("hash "+hashPass);

    var sql = `insert into user(name,email,password) values('${name}','${email}','${hashPass}')`;
    var result =  await conn.execute(sql);
    console.log(result[0])
    res.send("user register successfully!")


});


//user login
app.get('/login',(req,res) =>{
    res.render("login");
})

app.post("/login",async (req,res)=>{
    const {email,password} = req.body;
    var varifyUser = `select * from user where email = '${email}'`;
    var result = await conn.execute(varifyUser);
    if(result[0].length == 0){
        return res.send("user not found")
    }
    console.log(result[0]);
    const data = result[0];
    //comparing password
    let bpass = data[0].password;
    console.log("bpass",bpass)
    var match = await bcrypt.compare(password,bpass);
    console.log(match);
    if(!match){
        return res.send(`wrong password!`)
    }

    //generating jwt token
    const jwtToken = jwt.sign(data[0],"vijay");
    res.cookie("jwtToken",jwtToken);
    const tokenData = jwt.verify(jwtToken,"vijay");
    console.log(tokenData);
    res.render("home",{tokenData});


})

app.get("/home",(req,res)=>{
    const jwtToken = req.cookies.jwtToken;
    if(!jwtToken){
        return res.send(`you are not authorized register first <a href="/">register</a>`);
    }

})

app.get("/logout",(req,res)=>{
    res.clearCookie("jwtToken");
    res.redirect("/")

})


app.listen(port, () => console.log(`Example app listening on port ${port}!`))