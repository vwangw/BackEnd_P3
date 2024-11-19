//Practica 3 por Vicente Wang y Lucía Camiña

import { MongoClient, ObjectId } from "mongodb";
import type { BookModel } from "./types.ts";
import { fromModelToBook } from "./utils.ts";

const MONGO_URL = Deno.env.get("MONGO_URL");
if (!MONGO_URL) {
  console.error("MONGO_URL is not set");
  Deno.exit(1);
}

const client = new MongoClient(MONGO_URL);
await client.connect();
console.info("Connected to MongoDB");

const db = client.db("bibliotecadb");

const booksCollection = db.collection<BookModel>("books");

const handler = async (req: Request): Promise<Response> => {
  const method = req.method;
  const url = new URL(req.url);
  const path = url.pathname;

  if (method === "GET") {
    if (path === "/books") {
      const booksDB = await booksCollection.find().toArray();
      const books = booksDB.map((b) => fromModelToBook(b));
      return new Response(JSON.stringify(books));

    } else if (path.startsWith("/books/")) {
      
      const id = path.split("/")[2];
      if (!id) return new Response("Bad request", { status: 400 });
      const bookDB = await booksCollection.findOne({ _id: new ObjectId(id) });
      if (!bookDB) return new Response("Book not found", { status: 404 });
      const book = fromModelToBook(bookDB);
      return new Response(JSON.stringify(book));
    }
  } else if (method === "POST") {
    if(path === "/books") {
      const user = await req.json();
      if (!user.title || !user.author || !user.year) {
        return new Response("Bad request", { status: 400 });
      }

      const { insertedId } = await booksCollection.insertOne({
        title: user.title,
        author: user.author,
        year: user.year
      });

      return new Response(
        JSON.stringify({
          title: user.title,
          author: user.author,
          year: user.year,
          id: insertedId
        }),
        { status: 201 }
      );
    }
  } else if (method === "PUT") {
    if (path.startsWith("/books/")) {
      const id = path.split("/")[2];
      if (!id) return new Response("Bad request", { status: 400 });

      const updateData = await req.json();

      const fieldsToUpdate: Partial<BookModel> = {};
      if (updateData.title) fieldsToUpdate.title = updateData.title;
      if (updateData.author) fieldsToUpdate.author = updateData.author;
      if (updateData.year) fieldsToUpdate.year = updateData.year;

      if (Object.keys(fieldsToUpdate).length === 0) {
        return new Response(
          JSON.stringify({ error: "Debe enviar al menos un campo para actualizar (title, author o year)" }),
          { status: 400 }
        );
      }

      const { matchedCount } = await booksCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: fieldsToUpdate }
      );

      if (matchedCount === 0) {
        return new Response("Book not found", { status: 404 });
      }

      const updatedBook = await booksCollection.findOne({ _id: new ObjectId(id) });
      return new Response(JSON.stringify(fromModelToBook(updatedBook!)), { status: 200 });
    }
    
  } else if (method === "DELETE") {
    if (path.startsWith("/books/")) {
      const id = path.split("/")[2];
      if (!id) return new Response("Bad request", { status: 400 });
      const { deletedCount } = await booksCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (deletedCount === 0) {
        return new Response("Book not found", { status: 404 });
      }

      await booksCollection.updateMany(
        { books: new ObjectId(id) },
        { $pull: { books: new ObjectId(id) } }
      );

      return new Response("Deleted", { status: 200 });
    }
  }

  return new Response("endpoint not found", { status: 404 });
};

Deno.serve({ port: 3000 }, handler);