const express = require('express')
const app = express();
const bodyParser = require("body-parser");
const bcrypt = require('bcryptjs');
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const path = require('path');
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.set("view engine", "ejs");
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "/public")));

//connection
const conn = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "auth"
})
conn.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});

async function getdata(sql) {
    return new Promise((res, rej) => {
        conn.query(sql, (err, data) => {
            if (err) throw err;
            res(data);
        })
    })
}
// conn.getConnection((err,conn)=>{
//     console.log("connected")
// })

app.get('/', (req, res) => {
    const jwtToken = req.cookies.jwtToken;
    if (jwtToken) {
        return res.redirect("/home");
    }
    res.render("registration");
});


//user registration
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    var sql = `select * from user where email = '${email}'`;
    var result = await getdata(sql);
    

    console.log("query result" + result);
    if (result.length != 0) {
        return res.send(`User Already registered! please Login <a href="/login">login</a>`)
    }

    var hashPass = await bcrypt.hash(password, 10);
    console.log("hash " + hashPass);

    const activation_token = Math.random().toString(36).substring(2, 15);
    const activationLink = `http://localhost:3000/activate?token=${activation_token}`;
    var sql = `insert into user(name,email,password,activation_token) values('${name}','${email}','${hashPass}','${activation_token}')`;
    var result = await conn.execute(sql);
    console.log(result)

    //activation


    res.send(`user register successfully!  <a href="${activationLink}"> Activate Account </a>`);
});

app.get("/activate?", async (req, res) => {
    const actKey = req.query.token;
    sql = `update user set activated = 1 where activation_token = "${actKey}"`;
    var result = await getdata(sql);
    var json = JSON.stringify(result);
    console.log("activate result " + json)
    var arr = JSON.parse(json);
    if (arr.affectedRows == 0) {
        res.send("invalid activation link");
    } else {
        res.redirect("/login");
    }
});

//find user
app.get("/finduser?", async (req, res) => {
    const email = req.query.email;
    var sql = `select * from user where email = '${email}'`;
    var result = await getdata(sql);
    console.log(result);
    // var result = JSON.stringify(resu);
    if (result.length > 0) {
        res.json({ exists: true });
    } else {
        res.json({ exists: false });
    }

})

//user login
app.get('/login', (req, res) => {
    const jwtToken = req.cookies.jwtToken;
    if (jwtToken) {
        return res.redirect("http://localhost:3000/home");
    }
    res.render("login");
})

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    var varifyUser = `select * from user where email = '${email}'`;
    var result = await getdata(varifyUser);
    console.log("login result");
    console.log(result);
    if (result.length == 0) {
        return res.send(`user not regitered please register <a href="/">register</a>`)
    }
    const data = result;
    //comparing password
    let bpass = data[0].password;
    console.log("bpass", bpass)
    var match = await bcrypt.compare(password, bpass);
    console.log(match);
    if (!match) {
        return res.send(`wrong user or password!`)
    }
    const activationLink = `http://localhost:3000/activate?token=${data[0].activation_token}`;
    if (data[0].activated == 0) {
        return res.render("activate", { activationLink });
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
    res.render("home", { tokenData });

})

app.get("/logout", (req, res) => {
    res.clearCookie("jwtToken");
    res.redirect("login")

});

app.get("/edit?", (req, res) => {
    const jwtToken = req.cookies.jwtToken;
    if (!jwtToken) {
        return res.send(`you are not authorized register first <a href="/">register</a>`);
    }
    const tokenData = jwt.verify(jwtToken, "vijay");
    res.render("edit", { tokenData });
})

app.post("/edit", async (req, res) => {
    const { id, name, email, password, cpassword } = req.body;
    var sql = `SELECT * FROM auth.user where id = ${id};`
    const result = await getdata(sql);;
    var oldPass = result[0].password;
    console.log("old p " + oldPass);
    var hashp = await bcrypt.hash(cpassword, 10);
    var match = await bcrypt.compare(password, oldPass);
    console.log(match);
    if (match) {
        var sql1 = `update user set name = "${name}", email="${email}", password="${hashp}" where id= ${id};`
        var update = await getdata(sql1);
        console.log("edited");
        res.redirect('/home');
    } else {
        res.redirect('/edit');
        console.log("old password not mathed");
    }
})

app.get('/tasks', (req, res) => {
    res.render("tasks");
});


const conn2 = mysql.createConnection({
    host: "localhost",
    database: "student_db",
    user: "root",
    password: "root",
});
conn2.connect(function (err) {
    if (err) throw err;
    else console.log("connected2!");
});

//pagination and sorting 
app.get("/:page/:sort/:order/", (req, res) => {
    var pag = parseInt(req.params.page) || 1;
    var limit = 10;
    var offset = (pag - 1) * limit;
    var sortBy = req.params.sort || 'first_name';
    var sortOrder = req.params.order;


    conn2.query(
        `SELECT * FROM student_express order by ${sortBy} ${sortOrder} LIMIT ${offset}, ${limit}`,
        (err, result) => {
            if (err) throw err;

            conn2.query(
                "SELECT COUNT(*) as count FROM student_express",
                (err, countResult) => {
                    if (err) throw err;
                    let totalPages = Math.ceil(countResult[0].count / limit);

                    let pages = [];
                    for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                    }

                    res.render("table", {
                        data: result,
                        page: pag,
                        pages: pages,
                        sort: sortBy,
                        order: sortOrder
                    });
                }
            );
        }
    );
    console.log(pag);
    console.log(sortBy);
    console.log(sortOrder);
});

//
//pagination and sorting2
app.get("/pagination", (req, res) => {
    var pag = parseInt(req.query.page) || 1;
    var limit = 10;
    var offset = (pag - 1) * limit;
    var sortBy = req.query.sort || 'first_name';
    var search = req.query.search || '';
    // console.log(`search:${search}`);
    var sortOrder = req.query.order|| 'asc';
   
    
    conn2.query(
      "SELECT COUNT(*) as count FROM student_express",
      (err, countResult) => {
  
        if (err) throw err;
        if(pag > Math.ceil(countResult[0].count / limit) ){
          offset = Math.ceil(countResult[0].count / limit) - limit;
        }
       
    conn2.query(
      `SELECT * FROM student_express where first_name LIKE '${search}%' order by ${sortBy} ${sortOrder} LIMIT ${offset}, ${limit}`,
      (err, result) => {
        
  
        
            if (err) throw err;
            let totalPages = Math.ceil(countResult[0].count / limit);
  
            let pages = [];
            for (let i = 1; i <= totalPages; i++) {
              pages.push(i);
            }
           
            
            res.render("table2", {
              data: result,
              page: pag,
              pages: pages,
              sort: sortBy,
              order:sortOrder
            });
          }
        );
      }
    );
    console.log(pag);
  console.log(sortBy);
  console.log(sortOrder);
  });

  //delimeter search
  app.get("/search", (req, res) => {
    var searchValue = req.query.search || ' ';
    var multi = req.query.multi
    // if(req.query.search){
    //     searchValue = req.query.search
    // }else{
    //     searchValue=""
    // }
    
    var arr = [], arr2 = [], symbol = []

    var fName, lName, sEmail

    for (var i = 0; i < searchValue.length; i++) {
        if (searchValue[i] == '^' || searchValue[i] == '~' || searchValue[i] == '@') {
            arr.push(i)
            symbol.push(searchValue[i])
        }
    }
    console.log("String :- " + searchValue)
    console.log("array :- " + arr)

    for (var i = 0; i < arr.length; i++) {
        arr2.push(searchValue.substring(arr[i] + 1, arr[i + 1]))
    }
    var sql = `select * from student_express where `
    if (multi == 'and') {
       
        console.log(arr2)
        for (var i = 0; i < symbol.length; i++) {
            if (symbol[i] == '^') {
                fName = arr2[i]
                sql += `first_name="${fName.trim()}" and `
            }
            else if (symbol[i] == '~') {
                lName = arr2[i]
                sql += `last_name="${lName.trim()}" and `
            }
            else if (symbol[i] == '@') {
                sNumber = arr2[i]
                sql += `email="${sEmail.trim()}" and `
            }
        
        }
        sql = sql.slice(0, (sql.length - 5))
    }else{
        
        
        for (var i = 0; i < symbol.length; i++) {
            if (symbol[i] == '^') {
                fName = arr2[i]
                sql += `first_name="${fName.trim()}" `
                sql +='or '
            }
            else if (symbol[i] == '~') {
                lName = arr2[i]
                sql += `last_name="${lName.trim()}" `
                sql +='or '
            }
            else if (symbol[i] == '@') {
                sNumber = arr2[i]
                sql += `email="${sNumber.trim()}" `
                sql +='or '
            }
        }
        sql = sql.slice(0, (sql.length - 3))
        console.log(sql)
    }
    conn.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result)
        res.render('search', { data: result, searchValue });
    })
})






app.listen(port, () => console.log(`Example app listening on port ${port}!`))