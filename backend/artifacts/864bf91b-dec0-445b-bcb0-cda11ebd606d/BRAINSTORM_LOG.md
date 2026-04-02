**BRAINSTORM_LOG.md**

**Problem Framing**

* Initial problem statement: Develop a bookstore API
* Core questions:
	+ What is the purpose of the API?
	+ Who will be using the API?
	+ What are the key features and functionalities required?
* Hypothetical scenarios and edge cases considered:
	+ Sudden surge in mobile app traffic
	+ Insecure password storage
	+ Insufficient access controls
	+ Data model changes can be tricky to implement

**Wild Ideas**

* Implement a monolithic architecture
* Use a standard relational database (e.g., MySQL, PostgreSQL)
* Majority of API traffic will come from web applications
* Alternative idea 1: Use a microservices architecture, each service handling a specific business function (order management, stock tracking, user authentication)
* Alternative idea 2: Leverage a graph database (e.g., Neo4j) to store and manage book relationships, reducing the complexity of schema evolution
* Alternative idea 3: Implement a serverless architecture using AWS Lambda or Google Cloud Functions, minimizing server resources and costs while improving horizontal scaling

**System Shape**

```
          +---------------+
          |    API Gateway    |
          |  (e.g., NGINX or    |
          |   Amazon API Gateway)|
          +---------------+
                  |
                  |
                  v
+---------------------------------------+
|                    |                    |
|    Auth Microservice  |  Data Storage    |
|  (User authentication) |  (Graph Database  |
|                         |  e.g., Neo4j)      |
+---------------------------------------+
                  |
                  |
                  v
+---------------------------------------+
|                    |                    |
|    Order Management |  Inventory Service |
|  (Microservice for    |  (Microservice for|
|   order creation,    |   stock management) |
|   processing, and    |                    |
|   fulfillment)        |                    |
+---------------------------------------+
                  |
                  |
                  v
          +---------------+
          |     Web Application  |
          |  (Consumer of API      |
          |   Endpoints and data)  |
          +---------------+
```

**Key Components:**

1. **API Gateway:** Handles incoming requests, authenticates users, and directs traffic to appropriate microservices.
2. **Auth Microservice:** Responsible for user authentication and authorization.
3. **Data Storage:** Uses a graph database (e.g., Neo4j) to store and manage book relationships.
4. **Order Management:** Microservice handling order creation, processing, and fulfillment.
5. **Inventory Service:** Microservice for stock management and tracking.
6. **Web Application:** Consumes API endpoints and data for various book-related interactions.

**Feasibility Notes**

1. **API Gateway:** High feasibility
2. **Auth Microservice:** Medium-High feasibility
	+ Risk: Insecure password storage and insufficient access controls
3. **Data Storage (Graph Database):** Medium feasibility
	+ Risk: Difficulty in setting up and maintaining the graph structure
4. **Order Management Microservice:** Medium-High feasibility
	+ Risk: Data integrity issues during order creation, processing, and fulfillment
5. **Inventory Service Microservice:** Medium feasibility
	+ Risk: Inaccurate inventory data due to data inconsistencies or synchronization issues
6. **Web Application:** High feasibility
	+ Risk: Insufficient validation and sanitization of input data

**Key Decisions**

1. Implement a microservices architecture to improve scalability and fault tolerance.
2. Use a graph database (e.g., Neo4j) to store and manage book relationships.
3. Implement a serverless architecture using AWS Lambda or Google Cloud Functions for cost-effective and horizontally scalable services.
4. Use a reputable password hashing library (e.g., `bcrypt`) and store salted hashes securely.
5. Implement role-based access control (RBAC) and use an authorization library (e.g., `Casbin`) to manage granular access permissions.