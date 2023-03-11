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
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  res.render("tasks");
  
});

app.get('/tictac',(req,res)=>{
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  res.sendFile(path.join(__dirname+"/public/tic_tac_toy.html"))
});
app.get('/cubegame',(req,res)=>{
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  res.sendFile(path.join(__dirname+"/public/colorCube.html"))
});
app.get('/calculator',(req,res)=>{
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  res.sendFile(path.join(__dirname+"/public/calculator.html"))
})


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
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
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
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  var pag = parseInt(req.query.page) || 1;
  var limit = 10;
  var offset = (pag - 1) * limit;
  var sortBy = req.query.sort || 'first_name';
  var search = req.query.search || '';
  // console.log(`search:${search}`);
  var sortOrder = req.query.order || 'asc';


  conn2.query(
    "SELECT COUNT(*) as count FROM student_express",
    (err, countResult) => {

      if (err) throw err;
      if (pag > Math.ceil(countResult[0].count / limit)) {
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

//delimeter search
app.get("/search", (req, res) => {
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
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
  } else {


    for (var i = 0; i < symbol.length; i++) {
      if (symbol[i] == '^') {
        fName = arr2[i]
        sql += `first_name="${fName.trim()}" `
        sql += 'or '
      }
      else if (symbol[i] == '~') {
        lName = arr2[i]
        sql += `last_name="${lName.trim()}" `
        sql += 'or '
      }
      else if (symbol[i] == '@') {
        sNumber = arr2[i]
        sql += `email="${sNumber.trim()}" `
        sql += 'or '
      }
    }
    sql = sql.slice(0, (sql.length - 3))

  }
  conn2.query(sql, (err, result) => {
    if (err) throw err;
    res.render('search', { data: result, searchValue });
  })
})


//job Apllication form
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "job_application",
});

// Connect to the database
db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("Connected to databasejob Application")

});

// Set up the route for the job application form
app.get("/jobform", (req, res) => {

  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  db.query("SELECT * FROM state_master", (err, states) => {
    if (err) {
      throw err;
    }

    db.query(
      "SELECT option_name FROM option_master where select_id = 2",
      (err, rel) => {
        if (err) {
          throw err;
        }
        db.query(
          "SELECT option_name FROM option_master where select_id = 3",
          (err, location) => {
            if (err) {
              throw err;
            }

            db.query(
              "SELECT option_name FROM option_master where select_id = 4",
              (err, department) => {
                if (err) {
                  throw err;
                }
                db.query(
                  "SELECT option_name FROM option_master where select_id = 5",
                  (err, courses) => {
                    if (err) {
                      throw err;
                    }
                    db.query(
                      "SELECT option_name FROM option_master where select_id = 6",
                      (err, languages) => {
                        if (err) {
                          throw err;
                        }
                        db.query(
                          "SELECT option_name FROM option_master where select_id = 7",
                          (err, technologies) => {
                            if (err) {
                              throw err;
                            }

                            // Render the job application form and pass the data for the select boxes to the template
                            res.render("job_form", {
                              states: states,
                              relation: rel,
                              location: location,
                              dep: department,
                              course: courses,
                              language: languages,
                              tec: technologies,
                            });
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

app.get('/cities', (req, res) => {
  const stateId = req.query.stateId;
  db.query('SELECT * FROM city_master WHERE state_id = ?', [stateId], (error, cities) => {
    if (error) {
      console.error('Error fetching cities: ', error);
      res.sendStatus(500);
    } else {
      res.json(cities);
    }
  });
});




app.post("/submit", (req, res) => {
  

  const data = req.body;
  const course = req.body.course;
  const board = req.body.board;
  const passingyear = req.body.passingYear;
  const pr = req.body.percentage;
  console.log(course);
  console.log(board);
  console.log(passingyear);
  console.log(pr);
  const state = req.body.state;
  const city = req.body.city;
  let stateName = '';
  console.log(city);


  const basicSql = `INSERT INTO basic_info (first_name,last_name,gender,dob,job_designation,address1,email,phone,city,state,zip,relation_status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
  const basicValue = [
    data.first_name,
    data.last_name,
    data.gender,
    data.dob,
    data.job_designation,
    data.address1,
    data.email,
    data.phone,
    data.city,
    state,
    data.zip,
    data.relation_status,
  ];
  db.query(basicSql, basicValue, (err, result) => {
    if (err) {
      throw err;
    }

    //
    const applicantId = result.insertId;

    if (typeof (course, board, passingyear, pr) == "string") {
      eduSql = `insert into acadamics(applicant_id,course,board,passingYear,percentage) values
        ('${applicantId}','${course}','${board}','${passingyear}','${pr}')`;

      db.query(eduSql, (err, result) => {
        if (err) throw err;
        console.log("edu inserted");
      });
    } else {
      for (i = 0; i < course.length; i++) {
        eduSql = `insert into acadamics(applicant_id,course,board,passingYear,percentage) values
        ('${applicantId}','${course[i]}','${board[i]}','${passingyear[i]}','${pr[i]}')`;

        db.query(eduSql, (err, result) => {
          if (err) throw err;
          console.log("edu inserted");
        });
      }
    }

    const c_name = req.body.company_name;
    const desig = req.body.jobtitle;
    const start = req.body.start_date;
    const end = req.body.end_date;
    console.log(c_name);
    console.log(desig);
    console.log(start);
    console.log(end);
    if (typeof (c_name, desig, start, end) == "string") {
      expSql = `insert into work_experience(applicant_id,company_name,jobtitle,start_date,end_date) values
        ('${applicantId}','${c_name}','${desig}','${start}','${end}')`;

      db.query(expSql, (err, result) => {
        if (err) throw err;
        console.log("exp inserted");
      });
    } else {
      for (i = 0; i < c_name.length; i++) {
        expSql = `insert into work_experience(applicant_id,company_name,jobtitle,start_date,end_date) values
        ('${applicantId}','${c_name[i]}','${desig[i]}','${start[i]}','${end[i]}')`;

        db.query(expSql, (err, result) => {
          if (err) throw err;
          console.log("exp inserted");
        });
      }
    }


    //languages insert
    var lang = req.body.Language;
    var r = req.body[lang + "read"] ? "yes" : "no";
    var w = req.body[lang + "write"] ? "yes" : "no";
    var s = req.body[lang + "speak"] ? "yes" : "no";
    console.log(lang);
    console.log(r);
    if (typeof lang == "string") {
      var query_lan =
        "INSERT INTO LanguagesKnown(applicant_id,Language,`read`,`write`,`speak`) VALUES (?, ?, ?, ?, ?)";
      db.query(query_lan, [applicantId, lang, r, w, s], (err, ans) => {
        if (err) return console.log(err.message);
        console.log("languages inserted");
      });
    } else {
      lang.forEach((language) => {
        const read2 = req.body[language + "read"] ? "yes" : "no";
        const write2 = req.body[language + "write"] ? "yes" : "no";
        const speak2 = req.body[language + "speak"] ? "yes" : "no";

        db.query(
          "INSERT INTO LanguagesKnown(applicant_id,Language,`read`,`write`,`speak`) VALUES (?, ?, ?, ?, ?)",
          [applicantId, language, read2, write2, speak2],
          (err, result) => {
            if (err) {
              throw err;
            }

            console.log("language inserted");
          }
        );
      });
    }

    //getting technology
    const skills = req.body.technology;
    const lavel = req.body[skills + "a"];
    console.log("skills " + skills);
    if (typeof skills == "string") {
      db.query(
        "insert into skills(applicant_id,technology,lavel) values(?,?,?)",
        [applicantId, skills, lavel],
        (err, result) => {
          if (err) throw err;
          console.log("skills one inserted");
        }
      );
    } else {
      skills.forEach((tec) => {
        const lavel = req.body[tec + "a"];
        console.log("lavel " + lavel);
        db.query(
          "insert into skills(applicant_id,technology,lavel) values(?,?,?)",
          [applicantId, tec, lavel],
          (err, result) => {
            if (err) throw err;
            console.log("skills inserted");
          }
        );
      });
    }

    //getting references
    const rname = data.rname;
    const rcontact = data.rcontact;
    const relation = data.relation;
    console.log(rname);
    console.log(rcontact);
    console.log(relation);
    for (let i = 0; i < rname.length; i++) {
      db.query(
        `insert into reference(applicant_id,rname,rcontact,relation) 
        values('${applicantId}','${rname[i]}','${rcontact[i]}','${relation[i]}')`,
        (err, result) => {
          if (err) throw err;
          console.log("references inserted");
        }
      );
    }

    //preferences
    const plocation = data.location;
    const noticeperiod = data.notice;
    const ectc = data.expected_ctc;
    const pdepartment = data.department;
    db.query(
      `insert into preference(applicant_id,location,notice,expected_ctc,department) values
        ('${applicantId}','${plocation}','${noticeperiod}','${ectc}','${pdepartment}')`,
      (err, result) => {
        if (err) throw err;
        console.log("preferences inserted sucusessfully!");
      }
    );

    res.send("done");
  });
});




var limit = 10;
app.get('/view_data', (req, res) => {
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  var ajax = req.query.ajax || false;
  let k = (req.query.id - 1) * limit || 0;
  var sql12 = `select * from basic_info where is_deleted=0`;
  db.query(sql12, (err, result2) => {

    data12 = result2;
    var sql13 = `select * from basic_info where is_deleted!=1 limit ${k},${limit}`;
    db.query(sql13, (err, result) => {
      if (err) throw err;

      if (!ajax) {
        res.render("view_data", { record: result, count_record: data12.length, limit });
      }
      else {
        res.json(result);
      }
    });
  });
});

app.get("/search_data", function (req, res) {
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  const column = req.query.column;
  const term = req.query.term;
  const sql = `SELECT * FROM basic_info WHERE ${column} LIKE '%${term}%'`;

  db.query(sql, function (err, results) {
    if (err) throw err;

    db.query(`SELECT COUNT(*) as count FROM basic_info WHERE is_deleted = 0`, (err, count) => {
      if (err) throw err;
      const totcount = count[0].count;


      res.render("view_data", { record: results, count_record: totcount, term: term, limit });
    });
  });
});


app.get('/deleteData', (req, res) => {
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  var cd_id = req.query.id;
  db.query(`update basic_info set is_deleted = 1 where id in (${cd_id})`, (err, result) => {
    if (err) throw err;

  });
})

app.post('/deleteOne', (req, res) => {
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  var id = req.query.id;
  db.query(`update basic_info set is_deleted = 1 where id = ${id}`, (err, result) => {
    if (err) throw err;

  });
  res.json({ ans: "deleted successfully!" })
});

app.get('/retrive', (req, res) => {
  db.query("update basic_info set is_deleted = 0", (err, result) => {
    if (err) throw err;
    res.send('retrive succesfull');
  })
})



app.get("/edit_data", async (req, res) => {
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  var id = req.query.id;
  db.query("SELECT * FROM state_master", (err, states) => {
    if (err) {
      throw err;
    }

    db.query(
      "SELECT option_name FROM option_master where select_id = 2",
      (err, rel) => {
        if (err) {
          throw err;
        }
        db.query(
          "SELECT option_name FROM option_master where select_id = 3",
          (err, location) => {
            if (err) {
              throw err;
            }

            db.query(
              "SELECT option_name FROM option_master where select_id = 4",
              (err, department) => {
                if (err) {
                  throw err;
                }
                db.query(
                  "SELECT option_name FROM option_master where select_id = 5",
                  (err, courses) => {
                    if (err) {
                      throw err;
                    }
                    db.query(
                      "SELECT option_name FROM option_master where select_id = 6",
                      (err, languages) => {
                        if (err) {
                          throw err;
                        }
                        db.query(
                          "SELECT option_name FROM option_master where select_id = 7",
                          (err, technologies) => {
                            if (err) {
                              throw err;
                            }


                            //

                            db.query(`select * from basic_info where is_deleted=0 AND id = ${id}`, (err, basic_info) => {
                              if (err) throw err;
                              console.log(basic_info);
                              var stateId = basic_info[0].state;

                              db.query(`select * from state_master where id = ${stateId}`, (err, stateid) => {
                                if (err) throw err;
                                console.log("st" + stateid);


                                db.query(`select * from acadamics where applicant_id = ${id}`, (err, edu) => {
                                  if (err) throw err;
                                  console.log(edu);

                                  db.query(`select * from work_experience where applicant_id = ${id}`, (err, work) => {
                                    if (err) throw err;
                                    console.log(work);

                                    db.query(`select * from LanguagesKnown where applicant_id = ${id}`, (err, lang) => {
                                      if (err) throw err;
                                      var lanjson = JSON.stringify(lang);
                                      console.log(lang)
                                      console.log("lang" + lanjson);

                                      db.query(`select * from skills where applicant_id = ${id}`, (err, skill) => {
                                        if (err) throw err;
                                        console.log(lang);

                                        db.query(`select * from reference where applicant_id = ${id}`, (err, ref) => {
                                          if (err) throw err;

                                          db.query(`select * from preference where applicant_id = ${id}`, (err, pref) => {
                                            if (err) throw err;
                                            console.log(pref);




                                            // Render the job application form and pass the data for the select boxes to the template
                                            res.render("edit_data", {
                                              states: states,
                                              relation: rel,
                                              location: location,
                                              dep: department,
                                              course: courses,
                                              language: languages,
                                              tec: technologies,
                                              basic_info,
                                              edu,
                                              stateid,
                                              work,
                                              lanjson,
                                              lang,
                                              skill,
                                              ref,
                                              pref
                                            })
                                          });
                                        })

                                      })
                                    }
                                    );
                                  }
                                  );
                                }
                                );
                              }
                              );
                            }
                            );
                          }
                        );
                      });
                  });
              })
          })
      })
  })
})

//edit save data
app.post("/update", (req, res) => {
  const data = req.body;
  const course = req.body.course;
  const board = req.body.board;
  const passingyear = req.body.passingYear;
  const pr = req.body.percentage;
  console.log(course);
  console.log(board);
  console.log(passingyear);
  console.log(pr);
  const state = req.body.state;
  const city = req.body.city;
  const id = data.id;
  console.log("ID = " + id);

  console.log(city);
  const basicSql = `update basic_info set first_name =  "${data.first_name}", last_name = "${data.last_name}",
gender = "${data.gender}",dob = "${data.dob}",job_designation = "${data.job_designation}",address1="${data.address1}",
email = "${data.email}",phone="${data.phone}",city="${data.city}",state=${state},zip="${data.zip}",
relation_status = "${data.relation_status}" where id = ${id}
`;

  db.query(basicSql, (err, result) => {
    if (err) {
      throw err;
    }
  });

  db.query(`delete from acadamics where applicant_id=${id}`, (err, result) => {
    if (err) throw err;
    console.log("edu deleted");
  });
  applicantId = id;

  if (typeof (course, board, passingyear, pr) == "string") {
    eduSql = `insert into acadamics(applicant_id,course,board,passingYear,percentage) values
('${applicantId}','${course}','${board}','${passingyear}','${pr}')`;

    db.query(eduSql, (err, result) => {
      if (err) throw err;
      console.log("edu inserted");
    });
  } else {
    for (i = 0; i < course.length; i++) {
      eduSql = `insert into acadamics(applicant_id,course,board,passingYear,percentage) values
('${applicantId}','${course[i]}','${board[i]}','${passingyear[i]}','${pr[i]}')`;

      db.query(eduSql, (err, result) => {
        if (err) throw err;
        console.log("edu inserted");
      });
    }
  }

  // if (typeof (course, board, passingyear, pr) == "string") {
  //   eduSql = `update acadamics set course='${course}',board='${board}',passingYear='${passingyear}',percentage='${pr}' where applicant_id=${id}`;

  //   db.query(eduSql, (err, result) => {
  //     if (err) throw err;
  //     console.log("edu updated");
  //   });
  // } else {
  //   for (i = 0; i < course.length; i++) {
  //     eduSql = `update acadamics set course='${course[i]}',board='${board[i]}',passingYear='${passingyear[i]}',percentage='${pr[i]}' where applicant_id=${id}`;

  //     db.query(eduSql, (err, result) => {
  //       if (err) throw err;
  //       console.log("edu updated");
  //     });
  //   }
  // }
  db.query(`delete from work_experience where applicant_id = ${id}`, (err, result) => {
    if (err) throw err;
    console.log("work experience deleted!");
  })
  const c_name = req.body.company_name;
  const desig = req.body.jobtitle;
  const start = req.body.start_date;
  const end = req.body.end_date;
  console.log(c_name);
  console.log(desig);
  console.log(start);
  console.log(end);
  if (typeof (c_name, desig, start, end) == "string") {
    expSql = `insert into work_experience(applicant_id,company_name,jobtitle,start_date,end_date) values
('${applicantId}','${c_name}','${desig}','${start}','${end}')`;

    db.query(expSql, (err, result) => {
      if (err) throw err;
      console.log("exp inserted");
    });
  } else {
    for (i = 0; i < c_name.length; i++) {
      expSql = `insert into work_experience(applicant_id,company_name,jobtitle,start_date,end_date) values
('${applicantId}','${c_name[i]}','${desig[i]}','${start[i]}','${end[i]}')`;

      db.query(expSql, (err, result) => {
        if (err) throw err;
        console.log("exp inserted");
      });
    }
  }



  ////languages
  db.query(`delete from LanguagesKnown where applicant_id=${id}`, (err, result) => {
    if (err) throw err;
  });
  var applicantId = id;
  var lang = req.body.Language;
  var r = req.body[lang + "read"] ? "yes" : "no";
  var w = req.body[lang + "write"] ? "yes" : "no";
  var s = req.body[lang + "speak"] ? "yes" : "no";
  console.log(lang);
  console.log(r);
  if (typeof lang == "string") {
    var query_lan =
      "INSERT INTO LanguagesKnown(applicant_id,Language,`read`,`write`,`speak`) VALUES (?, ?, ?, ?, ?)";
    db.query(query_lan, [applicantId, lang, r, w, s], (err, ans) => {
      if (err) return console.log(err.message);
      console.log("languages inserted");
    });
  } else {
    lang.forEach((language) => {
      const read2 = req.body[language + "read"] ? "yes" : "no";
      const write2 = req.body[language + "write"] ? "yes" : "no";
      const speak2 = req.body[language + "speak"] ? "yes" : "no";

      db.query(
        "INSERT INTO LanguagesKnown(applicant_id,Language,`read`,`write`,`speak`) VALUES (?, ?, ?, ?, ?)",
        [applicantId, language, read2, write2, speak2],
        (err, result) => {
          if (err) {
            throw err;
          }

          console.log("language inserted");
        }
      );
    });
  }

  //getting technology
  db.query(`delete from skills where applicant_id = ${id}`, (err, result) => {
    if (err) throw err;
  });
  const skills = req.body.technology;
  const lavel = req.body[skills + "a"];
  console.log("skills " + skills);
  if (typeof skills == "string") {
    db.query(
      "insert into skills(applicant_id,technology,lavel) values(?,?,?)",
      [applicantId, skills, lavel],
      (err, result) => {
        if (err) throw err;
        console.log("skills one inserted");
      }
    );
  } else {
    skills.forEach((tec) => {
      const lavel = req.body[tec + "a"];
      console.log("lavel " + lavel);
      db.query(
        "insert into skills(applicant_id,technology,lavel) values(?,?,?)",
        [applicantId, tec, lavel],
        (err, result) => {
          if (err) throw err;
          console.log("skills inserted");
        }
      );
    });
  }

  db.query(`delete from reference where applicant_id = ${id}`, (err, result) => {
    if (err) throw err;
    console.log("references deleted")
  });
  //getting references
  const rname = data.rname;
  const rcontact = data.rcontact;
  const relation = data.relation;
  for (let i = 0; i < rname.length; i++) {
    db.query(
      `insert into reference(applicant_id,rname,rcontact,relation) 
values('${applicantId}','${rname[i]}','${rcontact[i]}','${relation[i]}')`,
      (err, result) => {
        if (err) throw err;
        console.log("ferences inserted");
      }
    );
  }

  //preferences
  const plocation = data.location;
  const noticeperiod = data.notice;
  const ectc = data.expected_ctc;
  const pdepartment = data.department;
  db.query(
    `update preference set location='${plocation}',notice='${noticeperiod}',expected_ctc='${ectc}',department='${pdepartment}' where applicant_id=${id}`,
    (err, result) => {
      if (err) throw err;
      console.log("preferences updated sucusessfully!");
    }
  );

  res.send("done");

});


//exel form
const db2 = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "job_application",
});

// Connect to the database
db2.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("Connected to database");
});

app.get('/exel',(req,res)=>{
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
  db2.query("select * from users",(err,users)=>{
      if(err) throw err;
 
  res.render("exel",{users});
});
})

app.get('/save',(req,res)=>{
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
const id = req.query.id;
const first_name = req.query.first_name;
const last_name = req.query.last_name;
const gender = req.query.gender;
const email = req.query.email;
const phone = req.query.phone;
db2.query('UPDATE users SET first_name = ?, last_name=?, gender=?,email=?,phone=? WHERE id = ?', [first_name,last_name,gender,email,phone,id], (error, results) => {
  if (error) throw error;
  console.log("updated!")
});
})

app.get('/add',(req,res)=>{
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }

var first_name = req.query.first_name;
var last_name = req.query.last_name;
var gender = req.query.gender;
var email = req.query.email;
var phone = req.query.phone;

db2.query("insert into users(first_name,last_name,gender,email,phone) value(?,?,?,?,?)",[first_name,last_name,gender,email,phone],(err,result)=>{
  if(err) throw err;
  console.log("inserted")
  res.redirect("exel")
})
})

app.post('/saveAll',(req,res)=>{
const id = req.body.user_id;
const first_name = req.body.first_name;
const last_name = req.body.last_name;
const gender = req.body.gender;
const email = req.body.email;
const phone = req.body.phone;
console.log(req.body);


for(let i=0; i<id.length; i++){
  let sql = `update users set first_name='${first_name[i]}',last_name='${last_name[i]}',gender='${gender[i]}',email='${email[i]}',phone='${phone[i]}' where id=${id[i]}`;
  db2.query(sql,(err,result)=>{
    if(err) throw err;
    console.log("updated all");
  })
} 
 

const fname = req.body.newfirst_name;
const lname = req.body.newlast_name;
const gen = req.body.newgender;
const em = req.body.newemail;
const ph = req.body.newphone;
console.log(typeof("type"+first_name));
if(typeof(fname) == "string"){
  db2.query('insert into users(first_name,last_name,gender,email,phone) value(?,?,?,?,?)',[fname,lname,gen,em,ph],(err,result)=>{
    if(err) throw err;
    console.log("inserted one")
  })
}else if(typeof(fname) == "object"){
  for(let j=0; j<fname.length; j++){
    db2.query('insert into users(first_name,last_name,gender,email,phone) value(?,?,?,?,?)',[fname[j],lname[j],gen[j],em[j],ph[j]],(err,result)=>{
      if(err) throw err;
      console.log("inserted all")
    })
  }
}

})

app.get('/delete',(req,res)=>{
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }
const uid = req.query.uid;
db2.query(`delete from users where id = ${uid}`,(err,result)=>{
  if(err) throw err;
  console.log("deleted");
  
})
})

//Generating Combo
app.get('/combo', async (req, res) => {
  const jwtToken = req.cookies.jwtToken;
  if (!jwtToken) {
    return res.redirect("login");
  }

  var c1 = await generateCombo('states');
  var c2 = await generateCombo('relationship');
  var c3 = await generateCombo('location');
  var c4 = await generateCombo('departments');
  var c5 = await generateCombo('courses');
  var c6 = await generateCombo('languages');
  var c7 = await generateCombo('technology');

  res.render('combo.ejs', { states: c1, relation: c2, location: c3,
       departments: c4, courses: c5, languages: c6,technology:c7 });

});


///ComboGenerator
async function generateCombo(combo) {

  var comboname = combo;

  var query2 = `select option_name,option_master.option_id from option_master join select_master on option_master.select_id = select_master.select_id where select_master.select_name ='${comboname}';`
  var data = await getdata2(query2);

  console.log(data);


  var comboStr = "";
  comboStr += `<lable for='${comboname}'>${comboname}</lable><select id='${comboname}' name='${comboname}'>`;

  for (let i = 0; i < data.length; i++) {
      comboStr += `<option value='${data[i].id}'>${data[i].option_name}</option>`;
  }

  comboStr += `</select>`;
  return comboStr;

}
function getdata2(query) {
  return new Promise((resolve, reject) => {
      db.query(query, (err, result) => {
          if (err) throw err;
          resolve(result);
      });
  });
}


app.listen(port, () => console.log(`Example app listening on port ${port}!`))