import React, { useEffect, useState } from "react";

export default function AddPastService({
  onSubmit,
  onClose,
  Sections,
  Services,
  Roles,
  Employees,
  createdBy,
  customerId = null,
  serviceStatus = "completed",
}) {

  const [sections] = useState(Sections);
  const [services, setServices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState(Employees);
  const [serviceAmount, setServiceAmount] = useState("");

  const [form, setForm] = useState({
    section_id: "",
    service_definition_id: "",

    service_date: "",
    service_time: "",

    customerNote: "",

    performers: [],
  });


  useEffect(() => {
    setEmployees(Employees);
  }, [Employees]);


  // -----------------------------
  // Select Section
  // -----------------------------
  const handleSectionSelect = (id) => {

    setForm({
      ...form,
      section_id: id,
      service_definition_id: "",
      performers: [],
    });


    setServices(
      Services.filter(
        (service)=>service.section_id === id
      )
    );


    setRoles([]);
  };



  // -----------------------------
  // Select Service
  // -----------------------------
  const handleServiceSelect = (e)=>{

    const id = Number(e.target.value);


    const serviceObj = JSON.parse(
      e.target.selectedOptions[0]
      .dataset.service
    );


    const matchingRoles = Roles.filter(
      role =>
      role.service_definition_id === id
    );


    const performers = matchingRoles.map((role)=>{

      const isSalon =
      role.role_name.toLowerCase()==="salon";


      return {

        role_id:role.id,

        employee_id:
        isSalon ? null : "",

        earned_amount:
        role.earned_amount

      };

    });



    setForm({

      ...form,

      service_definition_id:id,

      performers

    });



    setRoles(matchingRoles);


    setServiceAmount(
      Number(serviceObj.service_amount)
    );

  };



  // -----------------------------
  // Assign employee
  // -----------------------------
  const updatePerformer = (
    roleId,
    employeeId
  )=>{


    const updated =
    form.performers.map((p)=>


      p.role_id === roleId

      ?

      {
        ...p,

        employee_id:
        employeeId === ""
        ? null
        : employeeId
      }


      :

      p

    );


    setForm({

      ...form,

      performers:updated

    });

  };



  const handleCustomerNote=(e)=>{

    setForm({

      ...form,

      customerNote:e.target.value

    });

  };



  // -----------------------------
  // Submit
  // -----------------------------
  const handleSubmit = async (e) => {

  e.preventDefault();

  const missingEmployee = form.performers.some(
    (p) => p.employee_id === "" || p.employee_id === null
  );

  if (missingEmployee) {
    alert("Please assign all employees before saving.");
    return;
  }


    const payload = {

  entry_type: "past",

  section_id:
  form.section_id,

  service_definition_id:
  form.service_definition_id,

  service_date:
  form.service_date,

  service_time:
  form.service_time,


  appointment_date:null,

  appointment_time:null,


  customer_id:
  customerId,


  created_by:
  createdBy,


  customer_note:
  form.customerNote,


  status:
  serviceStatus,


  performers:
  form.performers.map((p)=>({

    role_id:p.role_id,

    employee_id:
    p.employee_id === ""
    ? null
    : p.employee_id,

    earned_amount:
    p.earned_amount

  }))

};



    console.log(
      "PAST SERVICE PAYLOAD",
      JSON.stringify(
        payload,
        null,
        2
      )
    );



    try {

  await onSubmit(payload);

  onClose();

} catch (err) {

  console.error(err);

}

  };





return (

<form
onSubmit={handleSubmit}
className="flex flex-col gap-4 w-full p-4 max-h-[80vh] overflow-y-auto"
>


<h2 className="text-lg font-semibold">
Add Previous Service
</h2>



{/* SECTION */}

<div className="flex flex-col">

<label>
Section
</label>


<select required

value={form.section_id}

onChange={(e)=>
handleSectionSelect(
Number(e.target.value)
)
}

>


<option value="">
Select Section
</option>


{
sections.map((s)=>(

<option
key={s.id}
value={s.id}
>

{s.section_name}

</option>

))
}


</select>

</div>





{/* SERVICE */}

{
services.length>0 &&

<div className="flex flex-col">

<label>
Service
</label>


<select required

value={
form.service_definition_id
}

onChange={handleServiceSelect}

>


<option value="">
Select Service
</option>


{

services.map((s)=>(

<option

key={s.id}

value={s.id}

data-service={
JSON.stringify(s)
}

>

{s.service_name}

</option>


))

}


</select>


</div>

}






{/* EMPLOYEES */}

{
roles.length>0 &&

<div className="flex flex-col gap-2">


{
roles.map((role)=>{


const isSalon =
role.role_name.toLowerCase()==="salon";


if(isSalon)
return null;



return (

<div
key={role.id}
>


<label>
{role.role_name}
</label>


<select required

value={

form.performers.find(
p=>p.role_id===role.id
)?.employee_id || ""

}


onChange={(e)=>
updatePerformer(
role.id,
e.target.value
)
}


>


<option value="">
Select Employee
</option>


{
employees.map((emp)=>(

<option

key={emp.id}

value={emp.id}

>

{emp.last_name}

</option>

))

}


</select>


</div>

)

})

}


</div>

}






{/* DATE */}

<div className="flex flex-col">

<label>
Service Date
</label>


<input

type="date"

required

value={form.service_date}

onChange={(e)=>

setForm({

...form,

service_date:e.target.value

})

}

/>

</div>






{/* OPTIONAL TIME */}

<div className="flex flex-col">

<label>
Service Time
</label>


<input

type="time"

required

value={form.service_time}

onChange={(e)=>

setForm({

...form,

service_time:e.target.value

})

}

/>


</div>







{/* NOTE */}

<div className="flex flex-col">


<label>
Additional Information
</label>


<textarea

value={form.customerNote}

onChange={handleCustomerNote}

placeholder="Notes about this service..."

className="border rounded p-2"

/>


</div>





{
form.service_definition_id &&

<p className="text-gray-700">

Service amount:

<span className="text-green-700 font-bold">

 UGX {serviceAmount}

</span>

</p>

}




<button

type="submit"

className="bg-blue-500 text-white p-2 rounded"

>

Save Past Service

</button>




</form>


);


}